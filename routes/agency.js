const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Ensure agency_payouts table exists on startup
db.query(`
    CREATE TABLE IF NOT EXISTS agency_payouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agency_id TEXT REFERENCES agencies(id) ON DELETE CASCADE,
        amount DECIMAL(12, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'processed',
        payment_method VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).catch(err => console.error('[DB] Error creating agency_payouts table:', err.message));

// --- AGENCY MANAGEMENT ---

// GET ALL AGENCIES WITH EARNINGS (FOR ADMIN DASHBOARD & PAYOUTS)
router.get('/admin/agencies/earnings', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                a.id, 
                a.name, 
                a.commission_rate, 
                a.pending_balance, 
                a.lifetime_earnings, 
                a.status, 
                a.referral_code,
                a.owner_id,
                u.username as owner_username, 
                u.display_name as owner_display_name,
                (SELECT COUNT(*)::int FROM users u2 WHERE u2.agency_id = a.id) as total_models
            FROM agencies a
            LEFT JOIN users u ON a.owner_id::text = u.id::text
            ORDER BY a.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET AGENCY PAYOUTS SUMMARY
router.get('/admin/payouts/summary', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT 
                COALESCE(SUM(pending_balance), 0) as total_pending,
                COALESCE(SUM(lifetime_earnings), 0) as total_lifetime,
                COALESCE((SELECT SUM(amount) FROM agency_payouts WHERE status = 'processed'), 0) as total_paid
            FROM agencies
        `);
        res.json(stats.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PROCESS AGENCY PAYOUT
router.post('/admin/agencies/:id/payout', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { amount, method } = req.body;
    try {
        await db.query('BEGIN');
        const agencyRes = await db.query('SELECT pending_balance FROM agencies WHERE id = $1 FOR UPDATE', [id]);
        if (agencyRes.rows.length === 0) throw new Error('Ajans bulunamadı.');
        
        const pending = parseFloat(agencyRes.rows[0].pending_balance || 0);
        const payoutAmount = parseFloat(amount || pending);
        
        if (payoutAmount <= 0) throw new Error('Ödenecek tutar 0 olamaz.');
        if (payoutAmount > pending) throw new Error('Ödenmek istenen tutar bekleyen bakiyeden büyük olamaz.');

        // 1. Insert into agency_payouts
        await db.query(`
            INSERT INTO agency_payouts (agency_id, amount, status, payment_method, processed_at)
            VALUES ($1, $2, 'processed', $3, NOW())
        `, [id, payoutAmount, method || 'Manual']);

        // 2. Decrement pending balance in agencies table
        await db.query(`
            UPDATE agencies 
            SET pending_balance = pending_balance - $1 
            WHERE id = $2
        `, [payoutAmount, id]);

        await db.query('COMMIT');
        res.json({ success: true, message: 'Ödeme başarıyla işlendi.' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// GET ALL AGENCIES
router.get('/admin/agencies', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT a.*, u.username as owner_name 
            FROM agencies a
            LEFT JOIN users u ON a.owner_id::text = u.id::text
            ORDER BY a.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE AGENCY
router.post('/admin/agencies', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    let { name, owner_id, commission_rate, status, referral_code } = req.body;
    try {
        let finalReferralCode = '';
        if (referral_code && referral_code.trim()) {
            finalReferralCode = referral_code.trim().toUpperCase();
            // Check uniqueness
            const dupCheck = await db.query('SELECT id FROM agencies WHERE UPPER(referral_code) = $1', [finalReferralCode]);
            if (dupCheck.rows.length > 0) {
                return res.status(400).json({ error: 'Bu referans kodu zaten başka bir ajans tarafından kullanılıyor.' });
            }
        } else {
            // Auto generate
            let isUnique = false;
            while (!isUnique) {
                const randomDigits = Math.floor(100 + Math.random() * 900);
                finalReferralCode = `FLK${randomDigits}`;
                const dupCheck = await db.query('SELECT id FROM agencies WHERE referral_code = $1', [finalReferralCode]);
                if (dupCheck.rows.length === 0) {
                    isUnique = true;
                }
            }
        }

        const result = await db.query(
            'INSERT INTO agencies (id, name, owner_id, commission_rate, status, referral_code) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [finalReferralCode, name, owner_id || null, commission_rate || 0.40, status || 'active', finalReferralCode]
        );
        if (owner_id) {
            await db.query('UPDATE users SET is_agency_owner = true WHERE id = $1', [owner_id]);
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE AGENCY
router.put('/admin/agencies/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    let { name, owner_id, commission_rate, status, referral_code } = req.body;
    try {
        let finalReferralCode = undefined;
        if (referral_code !== undefined) {
            if (referral_code && referral_code.trim()) {
                finalReferralCode = referral_code.trim().toUpperCase();
                // Check uniqueness excluding current
                const dupCheck = await db.query('SELECT id FROM agencies WHERE UPPER(referral_code) = $1 AND id != $2', [finalReferralCode, id]);
                if (dupCheck.rows.length > 0) {
                    return res.status(400).json({ error: 'Bu referans kodu zaten başka bir ajans tarafından kullanılıyor.' });
                }
            } else {
                return res.status(400).json({ error: 'Referans kodu boş olamaz.' });
            }
        }

        await db.query('BEGIN');
        if (finalReferralCode && finalReferralCode !== id) {
            // Cascade ID change to related tables manually to prevent FK constraint violations
            await db.query('UPDATE users SET agency_id = $1 WHERE agency_id = $2', [finalReferralCode, id]);
            await db.query('UPDATE agency_invitations SET agency_id = $1 WHERE agency_id = $2', [finalReferralCode, id]);
            await db.query('UPDATE agency_payouts SET agency_id = $1 WHERE agency_id = $2', [finalReferralCode, id]);
            await db.query('UPDATE commission_logs SET agency_id = $1 WHERE agency_id = $2', [finalReferralCode, id]);

            const result = await db.query(
                `UPDATE agencies 
                 SET id = $1,
                     name = COALESCE($2, name), 
                     owner_id = COALESCE($3, owner_id), 
                     commission_rate = COALESCE($4, commission_rate),
                     status = COALESCE($5, status),
                     referral_code = $1
                 WHERE id = $6 RETURNING *`,
                [finalReferralCode, name, owner_id, commission_rate, status, id]
            );
            await db.query('COMMIT');
            res.json(result.rows[0]);
        } else {
            const result = await db.query(
                `UPDATE agencies 
                 SET name = COALESCE($1, name), 
                     owner_id = COALESCE($2, owner_id), 
                     commission_rate = COALESCE($3, commission_rate),
                     status = COALESCE($4, status),
                     referral_code = COALESCE($5, referral_code)
                 WHERE id = $6 RETURNING *`,
                [name, owner_id, commission_rate, status, finalReferralCode, id]
            );
            await db.query('COMMIT');
            res.json(result.rows[0]);
        }
    } catch (err) {
        await db.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: err.message });
    }
});

// DELETE AGENCY
router.delete('/admin/agencies/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('BEGIN');

        // Get owner id to update flag later
        const agencyRes = await db.query('SELECT owner_id FROM agencies WHERE id = $1', [id]);
        if (agencyRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Ajans bulunamadı.' });
        }
        const ownerId = agencyRes.rows[0].owner_id;

        // 1. Unlink users
        await db.query('UPDATE users SET agency_id = NULL WHERE agency_id = $1', [id]);

        // 2. Delete agency
        await db.query('DELETE FROM agencies WHERE id = $1', [id]);

        // 3. Reset owner status if they do not own any other agency
        if (ownerId) {
            const ownCheck = await db.query('SELECT id FROM agencies WHERE owner_id = $1', [ownerId]);
            if (ownCheck.rows.length === 0) {
                await db.query('UPDATE users SET is_agency_owner = false WHERE id = $1', [ownerId]);
            }
        }

        await db.query('COMMIT');
        res.json({ success: true, message: 'Ajans başarıyla silindi ve tüm bağlı yayıncılar ajanstan ayrıldı.' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// ASSIGN USER TO AGENCY
router.post('/admin/users/:userId/assign-agency', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { userId } = req.params;
    const { agencyId } = req.body;
    try {
        await db.query('UPDATE users SET agency_id = $1 WHERE id = $2', [agencyId || null, userId]);
        res.json({ success: true, message: 'Kullanıcı ajansa başarıyla atandı.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET USER AGENCY INFO
router.get('/users/:id/agency', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT a.name, a.id, a.status, a.referral_code,
                   COALESCE(u2.display_name, u2.username, 'Bilinmiyor') as owner_name
            FROM users u
            JOIN agencies a ON u.agency_id::text = a.id::text
            LEFT JOIN users u2 ON a.owner_id::text = u2.id::text
            WHERE u.id::text = $1::text
        `, [req.params.id]);
        
        if (result.rows.length === 0) return res.json({ name: null });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// JOIN AGENCY (User side)
router.post('/agencies/join', authenticateToken, async (req, res) => {
    const { agencyId } = req.body;
    const userId = req.user.id;

    if (!agencyId) return res.status(400).json({ error: 'Ajans kodu gerekli.' });

    try {
        // 1. Check if agency exists by ID or by Referral Code
        let agencyRes;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(agencyId);
        
        if (isUuid) {
            agencyRes = await db.query(
                'SELECT id, name FROM agencies WHERE (id = $1 OR UPPER(referral_code) = UPPER($2)) AND status = \'active\'',
                [agencyId, agencyId]
            );
        } else {
            agencyRes = await db.query(
                'SELECT id, name FROM agencies WHERE UPPER(referral_code) = UPPER($1) AND status = \'active\'',
                [agencyId]
            );
        }

        if (agencyRes.rows.length === 0) {
            return res.status(404).json({ error: 'Geçersiz veya aktif olmayan ajans kodu.' });
        }

        const actualAgencyId = agencyRes.rows[0].id;
        const agencyName = agencyRes.rows[0].name;

        // 2. Update user's agency and automatically elevate role to 'operator' if female
        const isFemale = (req.user.gender || '').toLowerCase() === 'kadin';
        if (isFemale) {
            await db.query("UPDATE users SET agency_id = $1, role = 'operator' WHERE id = $2", [actualAgencyId, userId]);
            
            // Ensure operator entry exists
            const opCheck = await db.query('SELECT 1 FROM operators WHERE user_id::text = $1::text', [userId]);
            if (opCheck.rows.length === 0) {
                await db.query(
                    "INSERT INTO operators (user_id, category, bio, photos, is_online, rating) VALUES ($1, 'Genel', 'Merhaba!', '{}', false, 5.0)",
                    [userId]
                );
            }
            console.log(`[AGENCY] Elevated user ${userId} to operator upon joining agency.`);
        } else {
            await db.query('UPDATE users SET agency_id = $1 WHERE id = $2', [actualAgencyId, userId]);
        }
        
        console.log(`[AGENCY] User ${userId} joined agency ${agencyName}`);
        res.json({ success: true, message: `${agencyName} ajansına başarıyla katıldınız!`, agencyName });
    } catch (err) {
        console.error('[AGENCY] Join error:', err);
        res.status(500).json({ error: 'Ajansa katılırken bir hata oluştu.' });
    }
});

// ==========================================
// AGENCY PORTAL ENDPOINTS
// ==========================================

// GET AGENCY OWNER DASHBOARD
router.get('/agency/my-dashboard', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const weekOffset = parseInt(req.query.weekOffset || 0, 10);
        
        // 1. Fetch agency owned by this user
        const agencyRes = await db.query('SELECT * FROM agencies WHERE owner_id = $1 LIMIT 1', [userId]);
        if (agencyRes.rows.length === 0) {
            return res.status(404).json({ error: 'Ajans bulunamadı.' });
        }
        
        const agency = agencyRes.rows[0];
        
        // 2. Fetch operators belonging to this agency
        const operatorsQuery = `
            SELECT 
                u.id, 
                u.username, 
                u.display_name, 
                u.avatar_url,
                u.created_at as joined_at,
                o.is_online,
                o.rating,
                -- today_commission is operator's earned diamonds today
                COALESCE((
                    SELECT SUM(amount) 
                    FROM commission_logs 
                    WHERE operator_id::text = u.id::text 
                      AND agency_id::text = $1::text
                      AND created_at >= CURRENT_DATE
                ), 0) as today_commission,
                -- weekly_commission is operator's earned diamonds in the selected week
                COALESCE((
                    SELECT SUM(amount) 
                    FROM commission_logs 
                    WHERE operator_id::text = u.id::text 
                      AND agency_id::text = $1::text
                      AND created_at >= date_trunc('week', CURRENT_DATE) - ($2::integer * interval '1 week')
                      AND created_at < date_trunc('week', CURRENT_DATE) - (($2::integer - 1) * interval '1 week')
                ), 0) as weekly_commission,
                -- check if operator has any low quality logs today
                COALESCE((
                    SELECT EXISTS(
                        SELECT 1 
                        FROM commission_logs 
                        WHERE operator_id::text = u.id::text 
                          AND agency_id::text = $1::text
                          AND created_at >= CURRENT_DATE 
                          AND is_low_quality = true
                    )
                ), false) as is_low_quality
            FROM users u
            LEFT JOIN operators o ON u.id::text = o.user_id::text
            WHERE u.agency_id::text = $1::text
        `;
        const operatorsRes = await db.query(operatorsQuery, [agency.id, weekOffset]);
        const operators = operatorsRes.rows;
        
        // 3. Compute stats
        // today_diamonds: Sum of coins_earned today across all operators in the agency * agency rate
        const todayDiamondsQuery = `
            SELECT COALESCE(SUM(amount * $2), 0) as today_diamonds
            FROM commission_logs
            WHERE agency_id::text = $1::text AND created_at >= CURRENT_DATE
        `;
        const todayDiamondsRes = await db.query(todayDiamondsQuery, [agency.id, parseFloat(agency.commission_rate || 0.40)]);
        const today_diamonds = parseFloat(todayDiamondsRes.rows[0].today_diamonds);

        // weekly_diamonds: Sum of coins_earned in the selected week * agency rate
        const weeklyDiamondsQuery = `
            SELECT COALESCE(SUM(amount * $2), 0) as weekly_diamonds
            FROM commission_logs
            WHERE agency_id::text = $1::text 
              AND created_at >= date_trunc('week', CURRENT_DATE) - ($3::integer * interval '1 week')
              AND created_at < date_trunc('week', CURRENT_DATE) - (($3::integer - 1) * interval '1 week')
        `;
        const weeklyDiamondsRes = await db.query(weeklyDiamondsQuery, [agency.id, parseFloat(agency.commission_rate || 0.40), weekOffset]);
        const weekly_diamonds = parseFloat(weeklyDiamondsRes.rows[0].weekly_diamonds);
        
        // active_operators: count of operators in this agency who are online
        const activeOpsQuery = `
            SELECT COUNT(*) as active_count
            FROM users u
            JOIN operators o ON u.id::text = o.user_id::text
            WHERE u.agency_id::text = $1::text AND o.is_online = true
        `;
        const activeOpsRes = await db.query(activeOpsQuery, [agency.id]);
        const active_operators = parseInt(activeOpsRes.rows[0].active_count || 0);
        
        const total_operators = operators.length;
        
        res.json({
            agency: {
                id: agency.id,
                name: agency.name,
                pending_balance: parseFloat(agency.pending_balance || 0),
                lifetime_earnings: parseFloat(agency.lifetime_earnings || 0),
                commission_rate: parseFloat(agency.commission_rate || 0.40),
                status: agency.status
            },
            stats: {
                today_diamonds,
                weekly_diamonds,
                active_operators,
                total_operators
            },
            operators: operators.map(op => ({
                id: op.id,
                display_name: op.display_name,
                username: op.username,
                avatar_url: op.avatar_url,
                joined_at: op.joined_at,
                is_online: !!op.is_online,
                rating: parseFloat(op.rating || 5.0),
                today_commission: parseFloat(op.today_commission || 0),
                weekly_commission: parseFloat(op.weekly_commission || 0),
                is_low_quality: !!op.is_low_quality
            }))
        });
    } catch (err) {
        console.error('[my-dashboard] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST SEND INVITATION
router.post('/agency/invitations', authenticateToken, async (req, res) => {
    const { targetIdentifier } = req.body;
    const userId = req.user.id;
    if (!targetIdentifier) {
        return res.status(400).json({ error: 'Kullanıcı adı, ID veya Telefon girilmelidir.' });
    }
    try {
        await db.query('BEGIN');
        
        // 1. Fetch agency owned by this user
        const agencyRes = await db.query('SELECT id, name FROM agencies WHERE owner_id = $1 LIMIT 1', [userId]);
        if (agencyRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(403).json({ error: 'Ajans sahibi değilsiniz.' });
        }
        const agency = agencyRes.rows[0];
        
        // 2. Fetch target user
        const targetRes = await db.query(
            `SELECT id, username, display_name, role, gender, agency_id, is_agency_owner 
             FROM users 
             WHERE (id::text = $1 OR UPPER(username) = UPPER($1) OR phone = $1) LIMIT 1`,
            [targetIdentifier]
        );
        if (targetRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Yayıncı bulunamadı.' });
        }
        
        const targetUser = targetRes.rows[0];
        
        // Validation rules
        if (targetUser.is_agency_owner) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Ajans sahipleri başka bir ajansa katılamaz.' });
        }
        if (targetUser.agency_id) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Bu yayıncı zaten bir ajansa bağlı.' });
        }
        
        // 3. Check for existing pending invitation
        const existCheck = await db.query(
            "SELECT id FROM agency_invitations WHERE agency_id::text = $1::text AND operator_id::text = $2::text AND status = 'pending'",
            [agency.id, targetUser.id]
        );
        if (existCheck.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Bu yayıncıya zaten gönderilmiş bekleyen bir davet var.' });
        }
        
        // 4. Insert invitation
        await db.query(
            'INSERT INTO agency_invitations (agency_id, operator_id, status) VALUES ($1, $2, \'pending\')',
            [agency.id, targetUser.id]
        );
        
        await db.query('COMMIT');
        res.json({ success: true, message: 'Davet başarıyla gönderildi.' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('[agency-invitations] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET MY INVITATIONS (Operator side)
router.get('/agency/my-invitations', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db.query(
            `SELECT ai.id, a.name as agency_name, ai.created_at,
                    u.avatar_url as owner_avatar, u.display_name as owner_name, u.username as owner_username, u.id as owner_id
             FROM agency_invitations ai
             JOIN agencies a ON ai.agency_id::text = a.id::text
             LEFT JOIN users u ON a.owner_id::text = u.id::text
             WHERE ai.operator_id::text = $1::text AND ai.status = 'pending'
             ORDER BY ai.created_at DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST ACCEPT INVITATION
router.post('/agency/invitations/:inviteId/accept', authenticateToken, async (req, res) => {
    const { inviteId } = req.params;
    const userId = req.user.id;
    try {
        await db.query('BEGIN');
        
        // 1. Fetch invitation
        const inviteRes = await db.query(
            "SELECT agency_id, operator_id FROM agency_invitations WHERE id::text = $1::text AND operator_id::text = $2::text AND status = 'pending'",
            [inviteId, userId]
        );
        if (inviteRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Davet bulunamadı veya süresi geçmiş.' });
        }
        
        const { agency_id } = inviteRes.rows[0];
        
        // 2. Set the operator's agency and automatically elevate role to 'operator' if female
        const isFemale = (req.user.gender || '').toLowerCase() === 'kadin';
        if (isFemale) {
            await db.query("UPDATE users SET agency_id = $1, role = 'operator' WHERE id::text = $2::text", [agency_id, userId]);
            
            // Ensure operator entry exists
            const opCheck = await db.query('SELECT 1 FROM operators WHERE user_id::text = $1::text', [userId]);
            if (opCheck.rows.length === 0) {
                await db.query(
                    "INSERT INTO operators (user_id, category, bio, photos, is_online, rating) VALUES ($1, 'Genel', 'Merhaba!', '{}', false, 5.0)",
                    [userId]
                );
            }
            console.log(`[AGENCY] Elevated user ${userId} to operator upon accepting invitation.`);
        } else {
            await db.query('UPDATE users SET agency_id = $1 WHERE id::text = $2::text', [agency_id, userId]);
        }
        
        // 3. Mark accepted
        await db.query("UPDATE agency_invitations SET status = 'accepted' WHERE id::text = $1::text", [inviteId]);
        
        // 4. Mark all other invitations as rejected
        await db.query(
            "UPDATE agency_invitations SET status = 'rejected' WHERE operator_id::text = $1::text AND id::text != $2::text AND status = 'pending'",
            [userId, inviteId]
        );
        
        await db.query('COMMIT');
        res.json({ success: true, message: 'Ajans daveti kabul edildi.' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// POST REJECT INVITATION
router.post('/agency/invitations/:inviteId/reject', authenticateToken, async (req, res) => {
    const { inviteId } = req.params;
    const userId = req.user.id;
    try {
        const result = await db.query(
            "UPDATE agency_invitations SET status = 'rejected' WHERE id::text = $1::text AND operator_id::text = $2::text AND status = 'pending' RETURNING id",
            [inviteId, userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Davet bulunamadı veya süresi geçmiş.' });
        }
        res.json({ success: true, message: 'Davet reddedildi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST REMOVE OPERATOR FROM AGENCY
router.post('/agency/remove-operator', authenticateToken, async (req, res) => {
    const { operatorId } = req.body;
    const userId = req.user.id;
    if (!operatorId) {
        return res.status(400).json({ error: 'Yayıncı ID gerekli.' });
    }
    try {
        await db.query('BEGIN');
        
        // 1. Verify owner
        const agencyRes = await db.query('SELECT id FROM agencies WHERE owner_id = $1 LIMIT 1', [userId]);
        if (agencyRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(403).json({ error: 'Ajans sahibi değilsiniz.' });
        }
        const agencyId = agencyRes.rows[0].id;
        
        const operatorCheck = await db.query('SELECT id FROM users WHERE id::text = $1::text AND agency_id::text = $2::text', [operatorId, agencyId]);
        if (operatorCheck.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Yayıncı bu ajansa kayıtlı değil.' });
        }
        
        // 2. Unlink
        await db.query('UPDATE users SET agency_id = NULL WHERE id::text = $1::text', [operatorId]);
        
        await db.query('COMMIT');
        res.json({ success: true, message: 'Yayıncı ajanstan başarıyla çıkarıldı.' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// GET AGENCY APPLICATION STATUS (User side)
router.get('/agency/my-application', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        // 1. First check if the user is already an agency owner
        const userRes = await db.query('SELECT is_agency_owner FROM users WHERE id::text = $1::text', [userId]);
        if (userRes.rows.length > 0 && userRes.rows[0].is_agency_owner) {
            // Get agency details
            const agencyRes = await db.query('SELECT id, name, referral_code FROM agencies WHERE owner_id::text = $1::text LIMIT 1', [userId]);
            if (agencyRes.rows.length > 0) {
                return res.json({
                    status: 'approved',
                    agency_name: agencyRes.rows[0].name,
                    referral_code: agencyRes.rows[0].referral_code || agencyRes.rows[0].id,
                    created_at: new Date()
                });
            }
        }

        // 2. If not owner, check if there is an application in DB
        const result = await db.query(
            'SELECT * FROM agency_applications WHERE user_id::text = $1::text ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.json(null);
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('[my-application] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST AGENCY APPLICATION (User side)
router.post('/agency/applications', authenticateToken, async (req, res) => {
    const { agencyName, phone, reason } = req.body;
    const userId = req.user.id;

    if (!agencyName || !phone) {
        return res.status(400).json({ error: 'Ajans adı ve telefon numarası gerekli.' });
    }

    try {
        // Check if already owns an agency
        const userRes = await db.query('SELECT is_agency_owner FROM users WHERE id::text = $1::text', [userId]);
        if (userRes.rows.length > 0 && userRes.rows[0].is_agency_owner) {
            return res.status(400).json({ error: 'Zaten aktif bir ajansınız bulunmaktadır.' });
        }

        // Check if already has a pending application
        const existCheck = await db.query(
            "SELECT id FROM agency_applications WHERE user_id::text = $1::text AND status = 'pending'",
            [userId]
        );
        if (existCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Zaten bekleyen bir başvurunuz bulunmaktadır.' });
        }

        await db.query(
            'INSERT INTO agency_applications (user_id, agency_name, phone, reason, status) VALUES ($1, $2, $3, $4, \'pending\')',
            [userId, agencyName, phone, reason || '']
        );

        res.json({ success: true, message: 'Başvurunuz başarıyla alındı. Değerlendirme süreci başladı.' });
    } catch (err) {
        console.error('[applications] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
