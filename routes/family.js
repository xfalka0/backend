const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Helper configurations for cumulative XP levels
const LEVEL_THRESHOLDS = [
    { level: 8, xp: 3000000, maxMembers: 999999 },
    { level: 7, xp: 1500000, maxMembers: 500 },
    { level: 6, xp: 750000, maxMembers: 300 },
    { level: 5, xp: 300000, maxMembers: 200 },
    { level: 4, xp: 100000, maxMembers: 100 },
    { level: 3, xp: 25000, maxMembers: 50 },
    { level: 2, xp: 5000, maxMembers: 20 },
    { level: 1, xp: 0, maxMembers: 10 }
];

function getLevelInfo(points) {
    for (const lvl of LEVEL_THRESHOLDS) {
        if (points >= lvl.xp) {
            return lvl;
        }
    }
    return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
}

// Helper to award XP to family
async function awardFamilyXp(client, familyId, userId, xpAmount, sourceType) {
    // 1. Check daily XP contributed by this user today (Max 500 XP limit)
    const dailyLimit = 500;
    const logCheck = await client.query(`
        SELECT COALESCE(SUM(xp_amount), 0)::int as today_total
        FROM family_xp_logs
        WHERE user_id = $1 AND created_at >= CURRENT_DATE
    `, [userId]);

    const todayTotal = logCheck.rows[0].today_total;
    if (todayTotal >= dailyLimit) {
        return { success: false, reason: 'Kullanıcı günlük XP limitine (500 XP) ulaştı.' };
    }

    let actualXpToAward = xpAmount;
    if (todayTotal + xpAmount > dailyLimit) {
        actualXpToAward = dailyLimit - todayTotal;
    }

    if (actualXpToAward <= 0) return { success: false, reason: 'Eklenecek XP kalmadı.' };

    // 1b. Enforce family-wide daily limit of 50,000 XP from gifts (gift_sent, gift_received)
    if (sourceType === 'gift_sent' || sourceType === 'gift_received') {
        const familyGiftCheck = await client.query(`
            SELECT COALESCE(SUM(xp_amount), 0)::int as today_gift_total
            FROM family_xp_logs
            WHERE family_id = $1 AND source_type IN ('gift_sent', 'gift_received') AND created_at >= CURRENT_DATE
        `, [familyId]);

        const familyGiftTotal = familyGiftCheck.rows[0].today_gift_total;
        const familyGiftLimit = 50000;
        if (familyGiftTotal >= familyGiftLimit) {
            return { success: false, reason: 'Aile hediye XP günlük limitine (50000 XP) ulaştı.' };
        }
        if (familyGiftTotal + actualXpToAward > familyGiftLimit) {
            actualXpToAward = familyGiftLimit - familyGiftTotal;
        }
    }

    if (actualXpToAward <= 0) return { success: false, reason: 'Eklenecek hediye XP kalmadı.' };

    // 2. Insert XP Log
    await client.query(`
        INSERT INTO family_xp_logs (family_id, user_id, xp_amount, source_type)
        VALUES ($1, $2, $3, $4)
    `, [familyId, userId, actualXpToAward, sourceType]);

    // 3. Update family points & check level up
    const familyRes = await client.query(`
        SELECT level, points FROM families WHERE id = $1 FOR UPDATE
    `, [familyId]);

    if (familyRes.rows.length === 0) return { success: false, reason: 'Aile bulunamadı.' };

    let { level: oldLevel, points } = familyRes.rows[0];
    points += actualXpToAward;

    const levelInfo = getLevelInfo(points);
    const newLevel = levelInfo.level;
    const maxMembers = levelInfo.maxMembers;
    const leveledUp = newLevel > oldLevel;

    await client.query(`
        UPDATE families
        SET level = $1, points = $2, max_members = $3
        WHERE id = $4
    `, [newLevel, points, maxMembers, familyId]);

    // 4. Update member contribution
    await client.query(`
        UPDATE family_members
        SET daily_xp_contributed = daily_xp_contributed + $1,
            total_xp_contributed = total_xp_contributed + $1
        WHERE family_id = $2 AND user_id = $3
    `, [actualXpToAward, familyId, userId]);

    return { success: true, actualXpAwarded: actualXpToAward, leveledUp, newLevel };
}

// Expose helper functions on the router object
router.awardFamilyXp = awardFamilyXp;
router.getLevelInfo = getLevelInfo;
router.LEVEL_THRESHOLDS = LEVEL_THRESHOLDS;


// ─── 1. CREATE FAMILY ─────────────────────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
    const { name, description, badgeUrl, joinType } = req.body;
    const userId = req.user.id;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Aile ismi zorunludur.' });
    }

    try {
        await db.query('BEGIN');

        // Check if user is already in a family
        const memberCheck = await db.query('SELECT family_id FROM family_members WHERE user_id = $1', [userId]);
        if (memberCheck.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Zaten bir aileye üyesiniz.' });
        }

        // Check if user already owns/created a family
        const creatorCheck = await db.query('SELECT id FROM families WHERE creator_id = $1', [userId]);
        if (creatorCheck.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Zaten kurmuş olduğunuz bir aile var.' });
        }

        // Unique name check
        const nameCheck = await db.query('SELECT id FROM families WHERE UPPER(name) = UPPER($1)', [name.trim()]);
        if (nameCheck.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Bu aile ismi zaten kullanımda.' });
        }

        // Check user's role and balance
        const userRes = await db.query('SELECT balance, is_agency_owner FROM users WHERE id = $1 FOR UPDATE', [userId]);
        if (userRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const { balance, is_agency_owner } = userRes.rows[0];
        const cost = 5000;

        if (!is_agency_owner) {
            if (balance < cost) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: `Yetersiz bakiye. Aile kurmak için ${cost} altın gereklidir.` });
            }
            // Deduct balance
            await db.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [cost, userId]);
        }

        // Insert family
        const newFamily = await db.query(`
            INSERT INTO families (name, description, badge_url, creator_id, join_type)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [name.trim(), description || '', badgeUrl || null, userId, joinType || 'approval_required']);

        const familyId = newFamily.rows[0].id;

        // Insert creator as Leader
        await db.query(`
            INSERT INTO family_members (family_id, user_id, role)
            VALUES ($1, $2, 'leader')
        `, [familyId, userId]);

        // Initialize wallet
        await db.query(`
            INSERT INTO family_wallet (family_id, balance)
            VALUES ($1, 0)
        `, [familyId]);

        await db.query('COMMIT');
        res.status(201).json(newFamily.rows[0]);

    } catch (err) {
        await db.query('ROLLBACK');
        console.error('[Create Family] Error:', err.message);
        res.status(500).json({ error: 'Aile kurulurken sunucu hatası oluştu.' });
    }
});

// ─── 2. LIST/SEARCH FAMILIES ─────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    const { search } = req.query;
    try {
        let result;
        if (search && search.trim()) {
            result = await db.query(`
                SELECT f.*, u.username as creator_name
                FROM families f
                LEFT JOIN users u ON f.creator_id = u.id
                WHERE f.name ILIKE $1
                ORDER BY f.level DESC, f.member_count DESC
            `, [`%${search.trim()}%`]);
        } else {
            result = await db.query(`
                SELECT f.*, u.username as creator_name
                FROM families f
                LEFT JOIN users u ON f.creator_id = u.id
                ORDER BY f.level DESC, f.member_count DESC
                LIMIT 50
            `);
        }
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── 3. GET CALLER'S FAMILY (MY FAMILY) ──────────────────────────────────────
router.get('/my', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const memberRes = await db.query('SELECT family_id, role FROM family_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) {
            return res.json(null); // Not in a family
        }

        const familyId = memberRes.rows[0].family_id;
        const myRole = memberRes.rows[0].role;

        const familyRes = await db.query(`
            SELECT f.*, w.balance as wallet_balance
            FROM families f
            LEFT JOIN family_wallet w ON f.id = w.family_id
            WHERE f.id = $1
        `, [familyId]);

        const membersRes = await db.query(`
            SELECT fm.*, u.username, u.display_name, u.avatar_url
            FROM family_members fm
            JOIN users u ON fm.user_id = u.id
            WHERE fm.family_id = $1
            ORDER BY 
              CASE fm.role 
                WHEN 'leader' THEN 1 
                WHEN 'co_leader' THEN 2 
                WHEN 'officer' THEN 3 
                WHEN 'member' THEN 4 
                ELSE 5 
              END ASC
        `, [familyId]);

        res.json({
            myRole,
            family: familyRes.rows[0],
            members: membersRes.rows
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── 4. GET SPECIFIC FAMILY ──────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const familyRes = await db.query('SELECT * FROM families WHERE id = $1', [id]);
        if (familyRes.rows.length === 0) {
            return res.status(404).json({ error: 'Aile bulunamadı.' });
        }

        const membersRes = await db.query(`
            SELECT fm.*, u.username, u.display_name, u.avatar_url
            FROM family_members fm
            JOIN users u ON fm.user_id = u.id
            WHERE fm.family_id = $1
            ORDER BY 
              CASE fm.role 
                WHEN 'leader' THEN 1 
                WHEN 'co_leader' THEN 2 
                WHEN 'officer' THEN 3 
                WHEN 'member' THEN 4 
                ELSE 5 
              END ASC
        `, [id]);

        res.json({
            family: familyRes.rows[0],
            members: membersRes.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── 5. APPLY TO JOIN FAMILY ─────────────────────────────────────────────────
router.post('/:id/apply', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await db.query('BEGIN');

        // Check if user is already in a family
        const memberCheck = await db.query('SELECT family_id FROM family_members WHERE user_id = $1', [userId]);
        if (memberCheck.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Zaten bir aileye üyesiniz.' });
        }

        // Get family details
        const familyRes = await db.query('SELECT join_type, member_count, max_members FROM families WHERE id = $1', [id]);
        if (familyRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Aile bulunamadı.' });
        }

        const { join_type, member_count, max_members } = familyRes.rows[0];

        if (member_count >= max_members) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Bu aile maksimum üye limitine ulaştı.' });
        }

        if (join_type === 'invite_only') {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Bu aileye yalnızca davet ile katılınabilir.' });
        }

        if (join_type === 'open') {
            // Direct Join
            await db.query(`
                INSERT INTO family_members (family_id, user_id, role)
                VALUES ($1, $2, 'new_member')
            `, [id, userId]);

            await db.query('UPDATE families SET member_count = member_count + 1 WHERE id = $1', [id]);
            await db.query('COMMIT');
            return res.json({ success: true, joined: true, message: 'Aileye başarıyla katıldınız.' });
        }

        // Join Type: approval_required
        const existCheck = await db.query(
            "SELECT id FROM family_applications WHERE family_id = $1 AND user_id = $2 AND status = 'pending'",
            [id, userId]
        );
        if (existCheck.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Bu aile için zaten bekleyen bir katılım başvurunuz var.' });
        }

        await db.query(`
            INSERT INTO family_applications (family_id, user_id, status)
            VALUES ($1, $2, 'pending')
        `, [id, userId]);

        await db.query('COMMIT');
        res.json({ success: true, joined: false, message: 'Başvurunuz aile liderine gönderildi.' });

    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// ─── 6. GET PENDING APPLICATIONS ─────────────────────────────────────────────
router.get('/:id/applications', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Check if user has moderation role in this family
        const roleRes = await db.query(
            'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
            [id, userId]
        );
        if (roleRes.rows.length === 0 || !['leader', 'co_leader', 'officer'].includes(roleRes.rows[0].role)) {
            return res.status(403).json({ error: 'Yetkiniz bulunmamaktadır.' });
        }

        const apps = await db.query(`
            SELECT fa.*, u.username, u.display_name, u.avatar_url
            FROM family_applications fa
            JOIN users u ON fa.user_id = u.id
            WHERE fa.family_id = $1 AND fa.status = 'pending'
            ORDER BY fa.created_at DESC
        `, [id]);

        res.json(apps.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── 7. RESOLVE APPLICATION (ACCEPT/REJECT) ─────────────────────────────────
router.post('/:id/applications/:appId/resolve', authenticateToken, async (req, res) => {
    const { id, appId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'
    const userId = req.user.id;

    if (!['accept', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Geçersiz işlem.' });
    }

    try {
        await db.query('BEGIN');

        // Check if resolver has permissions
        const resolverRes = await db.query(
            'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
            [id, userId]
        );
        if (resolverRes.rows.length === 0 || !['leader', 'co_leader', 'officer'].includes(resolverRes.rows[0].role)) {
            await db.query('ROLLBACK');
            return res.status(403).json({ error: 'Yetkiniz bulunmamaktadır.' });
        }

        // Fetch application
        const appRes = await db.query(
            "SELECT user_id, status FROM family_applications WHERE id = $1 AND family_id = $2 FOR UPDATE",
            [appId, id]
        );
        if (appRes.rows.length === 0 || appRes.rows[0].status !== 'pending') {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Başvuru bulunamadı veya karara bağlanmış.' });
        }

        const targetUserId = appRes.rows[0].user_id;

        if (action === 'reject') {
            await db.query("UPDATE family_applications SET status = 'rejected' WHERE id = $1", [appId]);
            await db.query('COMMIT');
            return res.json({ success: true, message: 'Başvuru reddedildi.' });
        }

        // Action is 'accept' - Check space in family
        const familyRes = await db.query('SELECT member_count, max_members FROM families WHERE id = $1 FOR UPDATE', [id]);
        const { member_count, max_members } = familyRes.rows[0];

        if (member_count >= max_members) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Aile maksimum üye limitine ulaştı.' });
        }

        // Check target user is not already in a family
        const targetMemberCheck = await db.query('SELECT family_id FROM family_members WHERE user_id = $1', [targetUserId]);
        if (targetMemberCheck.rows.length > 0) {
            await db.query("UPDATE family_applications SET status = 'rejected' WHERE id = $1", [appId]);
            await db.query('COMMIT');
            return res.status(400).json({ error: 'Kullanıcı zaten başka bir aileye katılmış, başvuru iptal edildi.' });
        }

        // Accept: Add to members
        await db.query(`
            INSERT INTO family_members (family_id, user_id, role)
            VALUES ($1, $2, 'new_member')
        `, [id, targetUserId]);

        await db.query('UPDATE families SET member_count = member_count + 1 WHERE id = $1', [id]);
        await db.query("UPDATE family_applications SET status = 'accepted' WHERE id = $1", [appId]);

        await db.query('COMMIT');
        res.json({ success: true, message: 'Kullanıcı aileye kabul edildi.' });

    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// ─── 8. DAILY CHECK-IN ───────────────────────────────────────────────────────
router.post('/check-in', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        await db.query('BEGIN');

        // Check user's family
        const memberRes = await db.query('SELECT family_id FROM family_members WHERE user_id = $1', [userId]);
        if (memberRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Herhangi bir aileye üye değilsiniz.' });
        }

        const familyId = memberRes.rows[0].family_id;

        // Check if already checked in today
        const checkInLog = await db.query(`
            SELECT id FROM family_xp_logs
            WHERE user_id = $1 AND source_type = 'check_in' AND created_at >= CURRENT_DATE
        `, [userId]);

        if (checkInLog.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Bugün zaten check-in yaptınız.' });
        }

        const xpToAward = 10;
        const result = await awardFamilyXp(db, familyId, userId, xpToAward, 'check_in');

        if (!result.success) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: result.reason });
        }

        await db.query('COMMIT');
        res.json({
            success: true,
            message: `Günlük check-in başarılı! Ailenize +${result.actualXpAwarded} XP kazandırdınız.`,
            xpAwarded: result.actualXpAwarded,
            leveledUp: result.leveledUp,
            newLevel: result.newLevel
        });

    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// ─── 9. FAMILY MESSAGES (CHAT HISTORY) ───────────────────────────────────────
router.get('/:id/chat', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Verify user belongs to this family
        const memberCheck = await db.query('SELECT 1 FROM family_members WHERE family_id = $1 AND user_id = $2', [id, userId]);
        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Bu ailenin sohbet geçmişini görüntüleyemezsiniz.' });
        }

        const messages = await db.query(`
            SELECT fcm.*, u.username, u.display_name, u.avatar_url
            FROM family_chat_messages fcm
            JOIN users u ON fcm.sender_id = u.id
            WHERE fcm.family_id = $1
            ORDER BY fcm.created_at ASC
            LIMIT 100
        `, [id]);

        res.json(messages.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── 10. POST MESSAGE TO FAMILY CHAT ─────────────────────────────────────────
router.post('/:id/chat', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Boş mesaj gönderilemez.' });
    }

    try {
        // Verify user belongs to this family
        const memberCheck = await db.query('SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2', [id, userId]);
        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Bu aileye mesaj gönderemezsiniz.' });
        }

        const newMessage = await db.query(`
            INSERT INTO family_chat_messages (family_id, sender_id, message)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [id, userId, message.trim()]);

        // Get sender profile details for response
        const userRes = await db.query('SELECT username, display_name, avatar_url FROM users WHERE id = $1', [userId]);
        const responseData = {
            ...newMessage.rows[0],
            username: userRes.rows[0].username,
            display_name: userRes.rows[0].display_name,
            avatar_url: userRes.rows[0].avatar_url
        };

        res.json(responseData);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── 11. LEAVE FAMILY ────────────────────────────────────────────────────────
router.delete('/:id/leave', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        await db.query('BEGIN');

        // Check if user is in this family and their role
        const memberRes = await db.query('SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2', [id, userId]);
        if (memberRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Bu aileye üye değilsiniz.' });
        }

        const { role } = memberRes.rows[0];

        if (role === 'leader') {
            // Check if there are other members
            const memberCountCheck = await db.query('SELECT COUNT(*)::int as count FROM family_members WHERE family_id = $1', [id]);
            if (memberCountCheck.rows[0].count > 1) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'Aile lideri ayrılmadan önce liderliği başka bir üyeye devretmelidir.' });
            }
            // If they are the only member, delete family completely
            await db.query('DELETE FROM families WHERE id = $1', [id]);
        } else {
            // Remove member
            await db.query('DELETE FROM family_members WHERE family_id = $1 AND user_id = $2', [id, userId]);
            await db.query('UPDATE families SET member_count = member_count - 1 WHERE id = $1', [id]);
        }

        await db.query('COMMIT');
        res.json({ success: true, message: 'Aileden başarıyla ayrıldınız.' });

    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// ─── 12. KICK MEMBER ─────────────────────────────────────────────────────────
router.delete('/:id/members/:targetUserId', authenticateToken, async (req, res) => {
    const { id, targetUserId } = req.params;
    const userId = req.user.id;

    if (userId.toString() === targetUserId.toString()) {
        return res.status(400).json({ error: 'Kendinizi bu şekilde çıkartamazsınız. Aileden ayrılma seçeneğini kullanın.' });
    }

    try {
        await db.query('BEGIN');

        // Get resolver's role
        const resolverRes = await db.query('SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2', [id, userId]);
        if (resolverRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(403).json({ error: 'Bu aileye üye değilsiniz.' });
        }

        // Get target's role
        const targetRes = await db.query('SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2', [id, targetUserId]);
        if (targetRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Çıkartılmak istenen üye bu ailede bulunamadı.' });
        }

        const resolverRole = resolverRes.rows[0].role;
        const targetRole = targetRes.rows[0].role;

        // Role hierarchy check
        // leader can kick anyone.
        // co_leader can kick officer, member, new_member.
        // officer can kick member, new_member.
        // member/new_member cannot kick anyone.
        const roleWeights = { leader: 5, co_leader: 4, officer: 3, member: 2, new_member: 1 };
        const resolverWeight = roleWeights[resolverRole] || 0;
        const targetWeight = roleWeights[targetRole] || 0;

        if (resolverWeight <= 2 || resolverWeight <= targetWeight) {
            await db.query('ROLLBACK');
            return res.status(403).json({ error: 'Bu üyeyi aileden çıkartmak için yetkiniz yetersiz.' });
        }

        // Delete member
        await db.query('DELETE FROM family_members WHERE family_id = $1 AND user_id = $2', [id, targetUserId]);
        await db.query('UPDATE families SET member_count = member_count - 1 WHERE id = $1', [id]);

        await db.query('COMMIT');
        res.json({ success: true, message: 'Üye aileden başarıyla çıkarıldı.' });

    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// ─── 13. TRANSFER LEADERSHIP ─────────────────────────────────────────────────
router.post('/:id/transfer-leadership', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { targetUserId } = req.body;
    const userId = req.user.id;

    if (!targetUserId) return res.status(400).json({ error: 'Hedef kullanıcı belirtilmelidir.' });

    try {
        await db.query('BEGIN');

        // Check if caller is Leader
        const leaderCheck = await db.query("SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2 AND role = 'leader'", [id, userId]);
        if (leaderCheck.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(403).json({ error: 'Liderlik devretme yetkisi sadece Aile Liderine aittir.' });
        }

        // Check if target is a member of this family
        const targetCheck = await db.query("SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2", [id, targetUserId]);
        if (targetCheck.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Hedef kullanıcı bu aileye üye değil.' });
        }

        // Demote current leader to member, promote target to leader
        await db.query("UPDATE family_members SET role = 'member' WHERE family_id = $1 AND user_id = $2", [id, userId]);
        await db.query("UPDATE family_members SET role = 'leader' WHERE family_id = $1 AND user_id = $2", [id, targetUserId]);
        // Update families creator_id
        await db.query("UPDATE families SET creator_id = $1 WHERE id = $2", [targetUserId, id]);

        await db.query('COMMIT');
        res.json({ success: true, message: 'Aile Liderliği başarıyla devredildi.' });

    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
