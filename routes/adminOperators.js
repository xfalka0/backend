const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { sanitizeUser } = require('../utils/helpers');

// GET ALL OPERATORS (Public listing)
router.get('/', async (req, res) => {
    try {
        const { gender, page = 1, limit = 100, tab = 'Önerilen' } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.max(1, parseInt(limit) || 10);
        const offset = (pageNum - 1) * limitNum;

        let query = `
            SELECT u.id, COALESCE(u.display_name, u.username) as name,
                u.avatar_url, u.gender, u.age, u.vip_level, u.job, u.relationship, u.zodiac, u.interests, u.role,
                o.category, o.rating, o.is_online, COALESCE(o.bio, u.bio) as bio, o.photos,
                EXISTS(SELECT 1 FROM stories s WHERE s.operator_id = u.id AND s.expires_at > NOW()) as has_active_story
            FROM users u
            JOIN operators o ON u.id::text = o.user_id::text
            WHERE u.account_status = 'active' AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff')
        `;

        let params = [];
        let paramCount = 1;

        if (gender === 'erkek' || gender === 'kadin' || gender === 'male' || gender === 'female') {
            const normalizedGender = (gender === 'male' || gender === 'erkek') ? 'erkek' : 'kadin';
            query += ` AND (u.gender = $${paramCount} OR u.gender = 'coin_bayisi') `;
            params.push(normalizedGender);
            paramCount++;
        }

        let orderByClause = '';
        if (tab === 'Yeni') orderByClause = 'ORDER BY u.created_at DESC, u.id DESC';
        else if (tab === 'Popüler') orderByClause = 'ORDER BY u.vip_level DESC, o.rating DESC NULLS LAST, u.created_at DESC, u.id DESC';
        else orderByClause = 'ORDER BY o.is_online DESC, u.created_at DESC, u.id DESC';

        query += ` ${orderByClause} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(limitNum, offset);

        const result = await db.query(query, params);
        res.json(result.rows.map(row => sanitizeUser(row, req)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET SINGLE OPERATOR
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM operators WHERE user_id = $1', [id]);
        if (result.rows.length === 0) return res.json({ photos: [] });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE OPERATOR (Admin)
router.post('/', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { name, gender, bio, avatar_url, photos, age, category, job, relationship, zodiac, vip_level, interests } = req.body;
    try {
        await db.query('BEGIN');
        const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const username = `op_${name ? name.toLowerCase().replace(/\s+/g, '_') : 'unnamed'}_${uniqueId}`;
        const email = `${username}@fiva.admin`;
        const dummyPassword = await bcrypt.hash('op_pass_123!', 10);

        const userResult = await db.query(
            `INSERT INTO users (username, email, password, password_hash, role, display_name, name, gender, age, avatar_url, job, relationship, zodiac, interests, vip_level, account_status)
             VALUES ($1, $2, $3, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active') RETURNING id`,
            [username, email, dummyPassword, 'operator', name, gender || 'kadin', parseInt(age) || 18, avatar_url,
             job || null, relationship || null, zodiac || null, interests || '[]', parseInt(vip_level) || 0]
        );
        const userId = userResult.rows[0].id;
        const opResult = await db.query(
            `INSERT INTO operators (user_id, category, bio, photos, is_online, rating) VALUES ($1, $2, $3, $4, true, 5.0) RETURNING *`,
            [userId, category || 'Genel', bio || 'Merhaba!', photos || []]
        );
        await db.query('COMMIT');
        res.status(201).json({ ...opResult.rows[0], id: userId, name });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// UPDATE OPERATOR (Admin)
router.put('/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { name, gender, bio, avatar_url, photos, age, category, job, relationship, zodiac, vip_level, interests } = req.body;
    try {
        await db.query('BEGIN');
        const userUpdate = await db.query(
            `UPDATE users SET display_name = COALESCE($1, display_name), name = COALESCE($1, name), gender = COALESCE($2, gender),
             age = COALESCE($3, age), avatar_url = COALESCE($4, avatar_url), job = COALESCE($5, job),
             relationship = COALESCE($6, relationship), zodiac = COALESCE($7, zodiac), interests = COALESCE($8, interests), vip_level = COALESCE($9, vip_level)
             WHERE id = $10 RETURNING id`,
            [name, gender, isNaN(parseInt(age)) ? null : parseInt(age), avatar_url, job, relationship, zodiac, interests, isNaN(parseInt(vip_level)) ? null : parseInt(vip_level), id]
        );
        if (userUpdate.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Operatör bulunamadı.' });
        }
        await db.query(
            `UPDATE operators SET category = COALESCE($1, category), bio = COALESCE($2, bio), photos = COALESCE($3, photos) WHERE user_id = $4`,
            [category, bio, photos, id]
        );
        await db.query('COMMIT');
        res.json({ success: true, message: 'Profil güncellendi.' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// DELETE OPERATOR (Admin)
router.delete('/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    try {
        await db.query("DELETE FROM users WHERE id = $1", [id]);
        res.json({ success: true, message: 'Operatör tamamen silindi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ASSIGN PROFILE TO PERSONNEL
router.post('/:id/assign', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { personnelId } = req.body;
    try {
        await db.query('UPDATE users SET managed_by = $1 WHERE id = $2', [personnelId || null, id]);
        res.json({ success: true, message: 'Profil başarıyla personelde zimmetlendi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// OPERATOR EARNINGS (Admin)
router.get('/earnings/list', authenticateToken, authorizeRole('admin', 'super_admin', 'operator', 'moderator'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.role,
                COALESCE(o.pending_balance, 0) as pending_balance, COALESCE(o.lifetime_earnings, 0) as lifetime_earnings,
                COALESCE(o.commission_rate, 0.25) as commission_rate, o.last_payout_at, o.last_active_at,
                (SELECT COALESCE(SUM(coins_earned), 0) FROM operator_stats WHERE operator_id::text = u.id::text AND date = CURRENT_DATE) as earned_today,
                (SELECT COALESCE(SUM(messages_sent), 0) FROM operator_stats WHERE operator_id::text = u.id::text) as total_messages
            FROM users u
            LEFT JOIN operators o ON u.id::text = o.user_id::text
            WHERE u.role IN ('operator', 'moderator', 'admin', 'super_admin', 'staff') AND u.account_status = 'active'
            ORDER BY o.pending_balance DESC NULLS LAST
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PROCESS PAYOUT
router.post('/:id/payout', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { amount, method } = req.body;
    try {
        await db.query('BEGIN');
        const opRes = await db.query('SELECT pending_balance FROM operators WHERE user_id = $1 FOR UPDATE', [id]);
        if (opRes.rows.length === 0) throw new Error('Operatör bulunamadı.');
        const pending = opRes.rows[0].pending_balance;
        const payoutAmount = amount || pending;
        if (payoutAmount <= 0) throw new Error('Ödenecek tutar 0 olamaz.');
        if (payoutAmount > pending) throw new Error('Ödenmek istenen tutar bekleyen bakiyeden büyük olamaz.');

        await db.query('INSERT INTO payouts (operator_id, amount, status, payment_method, processed_at) VALUES ($1, $2, $3, $4, NOW())',
            [id, payoutAmount, 'processed', method || 'Manual']);
        await db.query('UPDATE operators SET pending_balance = pending_balance - $1, last_payout_at = NOW() WHERE user_id = $2', [payoutAmount, id]);
        await db.query('COMMIT');
        res.json({ success: true, message: 'Ödeme başarıyla işlendi.' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// PAYOUTS SUMMARY
router.get('/payouts/summary', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT SUM(pending_balance) as total_pending, SUM(lifetime_earnings) as total_lifetime,
                (SELECT SUM(amount) FROM payouts WHERE status = 'processed') as total_paid
            FROM operators
        `);
        res.json(stats.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MY OPERATOR STATS
router.get('/my/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.role,
                COALESCE(o.pending_balance, 0) as pending_balance, COALESCE(o.lifetime_earnings, 0) as lifetime_earnings,
                COALESCE(o.commission_rate, 0.25) as commission_rate, o.last_payout_at, o.last_active_at,
                (SELECT COALESCE(SUM(coins_earned), 0) FROM operator_stats WHERE operator_id::text = $1::text AND date = CURRENT_DATE) as earned_today,
                (SELECT COALESCE(SUM(messages_sent), 0) FROM operator_stats WHERE operator_id::text = $1::text) as total_messages
            FROM users u
            LEFT JOIN operators o ON u.id::text = o.user_id::text
            WHERE u.id::text = $1::text
        `;
        const result = await db.query(query, [userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Stats not found' });
        const weeklyRes = await db.query(`
            SELECT date, messages_sent, coins_earned FROM operator_stats
            WHERE operator_id::text = $1::text AND date >= CURRENT_DATE - INTERVAL '7 days' ORDER BY date DESC
        `, [userId]);
        res.json({ ...result.rows[0], weekly_stats: weeklyRes.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
