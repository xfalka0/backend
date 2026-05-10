const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { sanitizeUser, logActivity } = require('../utils/helpers');

// GET USER PROFILE
router.get('/:id', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(sanitizeUser(result.rows[0], req));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET USER ALBUM
router.get('/:id/album', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT photos FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        const photos = result.rows[0].photos || [];
        const sanitized = sanitizeUser({ photos }, req);
        res.json(sanitized.photos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER PROFILE (Simple)
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, display_name, age, gender, bio, job, edu } = req.body;
    const finalDisplayName = display_name || name;
    const finalName = name || display_name;
    try {
        const result = await db.query(
            `UPDATE users SET display_name = COALESCE($1, display_name), name = COALESCE($2, name),
             age = COALESCE($3::INTEGER, age), gender = COALESCE($4, gender), bio = COALESCE($5, bio),
             job = COALESCE($6, job), edu = COALESCE($7, edu) WHERE id = $8 RETURNING *`,
            [finalDisplayName || null, finalName || null, age ? parseInt(age) : null, gender || null, bio || null, job || null, edu || null, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(sanitizeUser(result.rows[0], req));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER PROFILE (Detailed / Onboarding)
router.put('/:id/profile', authenticateToken, async (req, res) => {
    const { id } = req.params;

    // Authorization check
    if (req.user.id.toString() !== id.toString() && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Yetkisiz işlem.' });
    }

    try {
        const result = await db.query(
            `UPDATE users SET
                display_name = COALESCE($1, display_name), name = COALESCE($2, name),
                bio = COALESCE($3, bio), avatar_url = COALESCE($4, avatar_url), gender = COALESCE($5, gender),
                interests = COALESCE($6, interests), onboarding_completed = COALESCE($7, onboarding_completed),
                age = COALESCE($8::INTEGER, age), relationship = COALESCE($9, relationship), zodiac = COALESCE($10, zodiac),
                job = COALESCE($11, job), edu = COALESCE($12, edu), boy = COALESCE($13, boy), kilo = COALESCE($14, kilo)
             WHERE id = $15 RETURNING *`,
            [
                req.body.display_name || req.body.name || null,
                req.body.name || req.body.display_name || null,
                req.body.bio || null,
                req.body.avatar_url || null,
                req.body.gender || null,
                req.body.interests || null,
                req.body.onboarding_completed !== undefined ? req.body.onboarding_completed : null,
                (req.body.age && !isNaN(parseInt(req.body.age))) ? parseInt(req.body.age) : null,
                req.body.relationship || null,
                req.body.zodiac || null,
                req.body.job || null,
                req.body.edu || null,
                req.body.boy || null,
                req.body.kilo || null,
                id
            ]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

        if (req.user.role === 'operator') {
            await db.query('UPDATE operators SET bio = COALESCE($1, bio) WHERE user_id = $2', [req.body.bio, id]);
        }
        res.json(sanitizeUser(result.rows[0], req));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE USER (Self or Admin)
router.delete('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    if (req.user.id.toString() !== id.toString() && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Yetkisiz işlem.' });
    }
    try {
        await db.query('BEGIN');
        const result = await db.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
        if (result.rowCount === 0) { await db.query('ROLLBACK'); return res.status(404).json({ error: 'Kullanıcı bulunamadı.' }); }
        await db.query('COMMIT');
        res.json({ success: true, message: 'Hesap başarıyla silindi.' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// GET USER CHATS
router.get('/:userId/chats', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await db.query(`
            SELECT c.id, c.operator_id, c.last_message_at,
                (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT COUNT(*)::int FROM messages WHERE chat_id = c.id AND sender_id != $1 AND is_read = false) as unread_count,
                COALESCE(u.display_name, u.username, 'Bilinmeyen Operatör') as name,
                COALESCE(u.avatar_url, 'https://via.placeholder.com/150') as avatar_url,
                u.vip_level, u.is_verified, u.gender, true as is_online
            FROM chats c
            LEFT JOIN users u ON c.operator_id = u.id
            WHERE c.user_id = $1
            ORDER BY COALESCE((SELECT MAX(created_at) FROM messages WHERE chat_id = c.id), c.last_message_at) DESC
        `, [userId]);
        res.json(result.rows.map(row => sanitizeUser(row, req)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET TOTAL UNREAD COUNT
router.get('/:userId/unread-count', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await db.query(`
            SELECT COUNT(*)::int as total_unread FROM messages m
            JOIN chats c ON m.chat_id = c.id
            WHERE c.user_id = $1 AND m.sender_id != $1 AND m.is_read = false
        `, [userId]);
        res.json({ count: result.rows[0].total_unread || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// USER BALANCE
router.get('/balance', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT balance FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ balance: result.rows[0].balance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE PUSH TOKEN
router.post('/push-token', authenticateToken, async (req, res) => {
    const { pushToken } = req.body;
    try {
        await db.query('UPDATE users SET push_token = $1 WHERE id = $2', [pushToken, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET USER AGENCY
router.get('/:id/agency', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT a.name, a.id, a.status FROM users u
            JOIN agencies a ON u.agency_id = a.id WHERE u.id = $1
        `, [req.params.id]);
        if (result.rows.length === 0) return res.json({ name: null });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// BLOCK USER
router.post('/block', authenticateToken, async (req, res) => {
    const { blockedId } = req.body;
    try {
        await db.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)', [req.user.id, blockedId]);
        res.json({ success: true, message: 'Kullanıcı engellendi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// REPORT USER
router.post('/report', authenticateToken, async (req, res) => {
    const { reportedId, reason, details } = req.body;
    try {
        await db.query('INSERT INTO reports (reporter_id, reported_id, reason, details) VALUES ($1, $2, $3, $4)',
            [req.user.id, reportedId, reason, details]);
        await db.query("UPDATE users SET account_status = 'under_review' WHERE id = $1", [reportedId]);
        res.json({ success: true, message: 'Kullanıcı raporlandı.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
