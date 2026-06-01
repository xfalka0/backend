const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { sanitizeUser, logActivity } = require('../utils/helpers');

// GET ALL USERS
router.get('/users', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT u.id, u.username, u.email, u.role, u.account_status, u.balance, 
                   u.is_vip, u.created_at, u.last_login_at, u.ban_expires_at, u.avatar_url,
                   u.referral_code,
                   r.username as referred_by_username
            FROM users u
            LEFT JOIN users r ON u.referred_by::text = r.id::text
            ORDER BY u.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET ALL STAFF (Admins, Moderators, Staff, Affiliaters)
router.get('/staff', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, username, email, role, referral_code, created_at 
            FROM users 
            WHERE role IN ('admin', 'super_admin', 'moderator', 'staff', 'affiliater')
            ORDER BY created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE STAFF
router.post('/staff', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { username, email, password, role } = req.body;
    if (!['admin', 'moderator', 'staff', 'affiliater'].includes(role)) {
        return res.status(400).json({ error: 'Geçersiz personel rolü.' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

        const result = await db.query(
            "INSERT INTO users (username, email, password_hash, role, referral_code, account_status) VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id, username, role, referral_code",
            [username, email, passwordHash, role, referralCode]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Bu kullanıcı adı veya e-posta zaten kullanımda.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE STAFF
router.delete('/staff/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    if (req.user.id === id) return res.status(400).json({ error: 'Kendinizi silemezsiniz.' });
    try {
        await db.query("DELETE FROM users WHERE id = $1", [id]);
        res.json({ success: true, message: 'Personel silindi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE USER (Admin)
router.post('/users', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { username, email, password, role } = req.body;
    if (!['admin', 'moderator', 'operator', 'user', 'staff', 'affiliater'].includes(role)) {
        return res.status(400).json({ error: 'Geçersiz rol.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.query(
            "INSERT INTO users (username, email, password, password_hash, role, balance) VALUES ($1, $2, $3, $3, $4, 0) RETURNING id, username, email, role",
            [username, email, hashedPassword, role]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Kullanıcı adı veya e-posta zaten mevcut.' });
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER ROLE
router.put('/users/:id/role', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    if (!['admin', 'moderator', 'operator', 'user', 'staff', 'affiliater'].includes(role)) {
        return res.status(400).json({ error: 'Geçersiz rol.' });
    }
    try {
        const result = await db.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
            [role, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

        if (role === 'operator') {
            const opCheck = await db.query('SELECT user_id FROM operators WHERE user_id = $1', [id]);
            if (opCheck.rows.length === 0) {
                await db.query(
                    "INSERT INTO operators (user_id, category, bio, photos, is_online, rating) VALUES ($1, 'Genel', 'Merhaba!', '{}', false, 5.0)",
                    [id]
                );
            }
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE STAFF REFERRAL CODE
router.put('/staff/:id/code', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { code } = req.body;
    if (!code || code.length < 3) return res.status(400).json({ error: 'Kod en az 3 karakter olmalıdır.' });
    
    try {
        const result = await db.query(
            'UPDATE users SET referral_code = $1 WHERE id = $2 RETURNING id, username, referral_code',
            [code.toUpperCase(), id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Bu kod zaten başka biri tarafından kullanılıyor.' });
        res.status(500).json({ error: err.message });
    }
});

// BAN USER
router.post('/users/:id/ban', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { duration } = req.body;
    try {
        let banExpiresAt = null;
        if (duration !== 'permanent') {
            const hours = parseInt(duration);
            if (!isNaN(hours)) {
                const date = new Date();
                date.setHours(date.getHours() + hours);
                banExpiresAt = date;
            }
        }
        await db.query('UPDATE users SET account_status = $1, ban_expires_at = $2 WHERE id = $3', ['banned', banExpiresAt, id]);
        res.json({ success: true, message: 'Kullanıcı banlandı.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UNBAN USER
router.post('/users/:id/unban', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    try {
        await db.query("UPDATE users SET account_status = 'active', ban_expires_at = NULL WHERE id = $1", [id]);
        res.json({ success: true, message: 'Ban kaldırıldı.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MANAGE BALANCE
router.post('/users/:id/balance', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    try {
        const result = await db.query(
            `UPDATE users SET balance = balance + $1, total_spent = total_spent + (CASE WHEN $1 > 0 THEN $1 ELSE 0 END) WHERE id = $2 RETURNING balance`,
            [amount, id]
        );
        const io = req.app.get('io');
        if (io) {
            io.emit('balance_update', { userId: id, newBalance: result.rows[0].balance });
            io.emit('admin_balance_update', { userId: id, newBalance: result.rows[0].balance });
        }
        res.json({ success: true, newBalance: result.rows[0].balance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE USER (Admin)
router.delete('/users/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    if (req.user.id === id) return res.status(400).json({ error: 'Kendinizi silemezsiniz.' });
    try {
        await db.query("DELETE FROM users WHERE id = $1", [id]);
        res.json({ success: true, message: 'Kullanıcı tamamen silindi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ASSIGN AGENCY
router.post('/users/:userId/assign-agency', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { userId } = req.params;
    const { agencyId } = req.body;
    try {
        await db.query('UPDATE users SET agency_id = $1 WHERE id = $2', [agencyId || null, userId]);
        res.json({ success: true, message: 'Kullanıcı ajansa başarıyla atandı.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET ALL STAFF
router.get('/staff', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query("SELECT id, username, email, role, referral_code, created_at FROM users WHERE role IN ('admin', 'moderator', 'operator', 'staff', 'affiliater') ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE STAFF
router.post('/staff', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { username, email, password, role } = req.body;
    if (!['admin', 'moderator', 'operator', 'staff', 'affiliater'].includes(role)) {
        return res.status(400).json({ error: 'Geçersiz rol.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Generate random 8-character referral code
        const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

        const result = await db.query(
            "INSERT INTO users (username, email, password, password_hash, role, balance, account_status, referral_code) VALUES ($1, $2, $3, $3, $4, 0, 'active', $5) RETURNING id, username, email, role, referral_code",
            [username, email, hashedPassword, role, referralCode]
        );
        if (role === 'operator' || role === 'staff') {
            await db.query(
                "INSERT INTO operators (user_id, category, bio, photos, is_online, rating) VALUES ($1, 'Genel', 'Merhaba!', '{}', false, 5.0)",
                [result.rows[0].id]
            );
        }
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Kullanıcı adı/E-posta kullanımda.' });
        res.status(500).json({ error: err.message });
    }
});

// DELETE STAFF
router.delete('/staff/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    if (req.user.id === id) return res.status(400).json({ error: 'Kendinizi silemezsiniz.' });
    try {
        await db.query("DELETE FROM users WHERE id = $1", [id]);
        res.json({ success: true, message: 'Personel tamamen silindi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ACTIVITIES
router.get('/activities', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT a.*, u.username as user_name, u.avatar_url as user_avatar 
            FROM activities a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC LIMIT 20
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PERSONAL STATS (Operators / Staff)
router.get('/my-stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        if (role !== 'operator' && role !== 'staff') {
            return res.status(403).json({ error: 'Bu verileri görme yetkiniz yok.' });
        }
        const todayStats = await db.query(
            "SELECT COALESCE(SUM(messages_sent), 0) as messages, COALESCE(SUM(coins_earned), 0) as coins FROM operator_stats WHERE operator_id::text = $1 AND date = CURRENT_DATE",
            [userId.toString()]
        );
        const operatorInfo = await db.query(
            "SELECT pending_balance, lifetime_earnings FROM operators WHERE user_id::text = $1",
            [userId.toString()]
        );
        const weeklyStats = await db.query(`
            SELECT date as label, messages_sent as value 
            FROM operator_stats WHERE operator_id::text = $1 
            ORDER BY date DESC LIMIT 7
        `, [userId.toString()]);

        res.json({
            today: todayStats.rows[0],
            info: operatorInfo.rows[0] || { pending_balance: 0, lifetime_earnings: 0 },
            chart: weeklyStats.rows.reverse()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// STAFF ACTIVITY
router.get('/staff-activity', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.role,
                (SELECT COUNT(*) FROM messages m JOIN chats c ON m.chat_id = c.id WHERE m.sender_id = u.id AND m.created_at >= CURRENT_DATE) as messages_today,
                (SELECT COUNT(*) FROM messages m JOIN chats c ON m.chat_id = c.id WHERE m.sender_id = u.id AND m.created_at >= NOW() - interval '7 days') as messages_week
            FROM users u
            WHERE u.role IN ('operator', 'moderator', 'admin', 'super_admin', 'staff')
            ORDER BY messages_today DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// AFFILIATE STATS
router.get('/affiliate-stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        if (role !== 'affiliater' && role !== 'admin' && role !== 'super_admin') {
            return res.status(403).json({ error: 'Yetkiniz yok.' });
        }

        // 0. Get user's referral code
        const userCodeRes = await db.query("SELECT referral_code FROM users WHERE id = $1", [userId]);
        const myCode = userCodeRes.rows[0]?.referral_code;

        // 1. Stats with string casting for IDs
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*)::int FROM users WHERE referred_by::text = $1::text) as "totalReferrals",
                (SELECT COUNT(*)::int FROM users WHERE referred_by::text = $1::text AND created_at > NOW() - INTERVAL '24 hours') as "todayReferrals",
                (SELECT COUNT(*)::int FROM referral_clicks WHERE code = $2) as "linkClicks"
        `;
        const stats = await db.query(statsQuery, [userId.toString(), myCode]);

        // 2. Earnings (20% of actual completed payments)
        const earnings = await db.query(`
            SELECT 
                COALESCE(SUM(p.amount * 0.2), 0) as total_earnings,
                COALESCE(SUM(CASE WHEN p.created_at >= CURRENT_DATE THEN p.amount * 0.2 ELSE 0 END), 0) as earnings_today
            FROM payments p
            JOIN users u ON p.user_id = u.id
            WHERE u.referred_by::text = $1::text AND p.status = 'completed'
        `, [userId]);

        // 3. Last 10 Referrals
        const lastReferrals = await db.query(
            "SELECT username, display_name, created_at, avatar_url FROM users WHERE referred_by::text = $1::text ORDER BY created_at DESC LIMIT 10",
            [userId]
        );

        res.json({
            stats: {
                totalReferrals: stats.rows[0].totalReferrals,
                todayReferrals: stats.rows[0].todayReferrals,
                totalEarnings: parseFloat(earnings.rows[0].total_earnings).toFixed(2),
                todayEarnings: parseFloat(earnings.rows[0].earnings_today).toFixed(2),
                totalClicks: stats.rows[0].linkClicks,
                todayClicks: 0 // Will refine this later if needed
            },
            referrals: lastReferrals.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
