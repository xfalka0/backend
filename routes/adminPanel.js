const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { sanitizeUser } = require('../utils/helpers');

// GET ADMIN STATS (Dashboard)
router.get('/stats', authenticateToken, authorizeRole('admin', 'super_admin', 'moderator'), async (req, res) => {
    try {
        const revResult = await db.query('SELECT SUM(total_spent) as total FROM users');
        const userResult = await db.query("SELECT COUNT(*) as count FROM users WHERE role = 'user'");
        const msgResult = await db.query('SELECT COUNT(*) as count FROM messages');
        const opResult = await db.query('SELECT COUNT(*) as count FROM operators WHERE is_online = true');

        const revenueChart = await db.query(`
            SELECT TO_CHAR(date_trunc('day', created_at), 'DD.MM') as label, SUM(amount) as value
            FROM transactions WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY date_trunc('day', created_at) ORDER BY date_trunc('day', created_at) ASC
        `);
        const registrationChart = await db.query(`
            SELECT TO_CHAR(date_trunc('day', created_at), 'DD.MM') as label, COUNT(*) as value
            FROM users WHERE role = 'user' AND created_at >= NOW() - INTERVAL '7 days'
            GROUP BY date_trunc('day', created_at) ORDER BY date_trunc('day', created_at) ASC
        `);
        const newUsersLists = {
            today: await db.query("SELECT id, username, display_name, email, gender, created_at, avatar_url FROM users WHERE role = 'user' AND created_at >= date_trunc('day', NOW()) ORDER BY created_at DESC LIMIT 10"),
            week: await db.query("SELECT id, username, display_name, email, gender, created_at, avatar_url FROM users WHERE role = 'user' AND created_at >= date_trunc('week', NOW()) ORDER BY created_at DESC LIMIT 10"),
            month: await db.query("SELECT id, username, display_name, email, gender, created_at, avatar_url FROM users WHERE role = 'user' AND created_at >= date_trunc('month', NOW()) ORDER BY created_at DESC LIMIT 10")
        };
        const newUsersCounts = await db.query(`
            SELECT COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW())) as today,
                   COUNT(*) FILTER (WHERE created_at >= NOW() - interval '7 days') as week,
                   COUNT(*) FILTER (WHERE created_at >= NOW() - interval '30 days') as month
            FROM users WHERE role = 'user'
        `);

        res.json({
            revenue: parseFloat(revResult.rows[0].total || 0).toFixed(2),
            activeUsers: parseInt(userResult.rows[0].count),
            messages: parseInt(msgResult.rows[0].count),
            onlineOperators: parseInt(opResult.rows[0].count),
            charts: { revenue: revenueChart.rows, registrations: registrationChart.rows },
            newUsers: {
                counts: {
                    today: parseInt(newUsersCounts.rows[0].today || 0),
                    week: parseInt(newUsersCounts.rows[0].week || 0),
                    month: parseInt(newUsersCounts.rows[0].month || 0)
                },
                lists: {
                    today: newUsersLists.today.rows,
                    week: newUsersLists.week.rows,
                    month: newUsersLists.month.rows
                }
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET ADMIN PAYMENTS
router.get('/payments', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT t.*, u.username as user_name, u.email FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ANALYTICS - SUMMARY
router.get('/analytics/summary', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT COUNT(*) FILTER (WHERE role = 'user') as total_users,
                   COUNT(*) FILTER (WHERE role = 'user' AND created_at >= date_trunc('day', NOW())) as new_today,
                   (SELECT COUNT(*) FROM messages) as total_messages,
                   (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'purchase') as total_revenue
            FROM users
        `);
        res.json(stats.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ANALYTICS - TOP BUYERS
router.get('/analytics/top-buyers', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, username, display_name, avatar_url, total_spent, balance, created_at
            FROM users WHERE total_spent > 0 ORDER BY total_spent DESC LIMIT 20
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ANALYTICS - RETENTION
router.get('/analytics/retention', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                COUNT(*) FILTER (WHERE last_login_at >= NOW() - interval '1 day') as active_1d,
                COUNT(*) FILTER (WHERE last_login_at >= NOW() - interval '7 days') as active_7d,
                COUNT(*) FILTER (WHERE last_login_at >= NOW() - interval '30 days') as active_30d,
                COUNT(*) as total
            FROM users WHERE role = 'user'
        `);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// COMMISSION LOGS
router.get('/commission-logs', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT cl.*, u.username as operator_name FROM commission_logs cl
            LEFT JOIN users u ON cl.operator_id::text = u.id::text
            ORDER BY cl.created_at DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// REFERRALS - LINK
router.post('/referrals/link', authenticateToken, async (req, res) => {
    const { referredUserId, referrerId } = req.body;
    try {
        await db.query('UPDATE users SET referred_by = $1 WHERE id = $2 AND referred_by IS NULL', [referrerId, referredUserId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// REFERRALS - STATS
router.get('/referrals/stats', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT u.id, u.username, u.display_name, u.avatar_url,
                COUNT(r.id) as referral_count,
                COALESCE(SUM(r.total_spent), 0) as referral_revenue
            FROM users u
            LEFT JOIN users r ON r.referred_by = u.id
            WHERE u.role IN ('staff', 'operator', 'admin', 'super_admin')
            GROUP BY u.id ORDER BY referral_count DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// NOTIFICATIONS - HISTORY
router.get('/notifications/history', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM push_notifications ORDER BY created_at DESC LIMIT 50');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message || 'Table may not exist yet' });
    }
});

// NOTIFICATIONS - SEND
router.post('/notifications/send', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { title, body, target } = req.body;
    try {
        const { sendPushNotification } = require('../utils/notificationUtils');
        let targets = [];
        if (target === 'all') {
            const usersRes = await db.query("SELECT id FROM users WHERE role = 'user' AND push_token IS NOT NULL");
            targets = usersRes.rows.map(u => u.id);
        }
        let sent = 0;
        for (const userId of targets) {
            try {
                await sendPushNotification(userId, { title, body, data: { type: 'broadcast' } });
                sent++;
            } catch (e) { /* skip */ }
        }
        res.json({ success: true, sent });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CAMPAIGNS - GET
router.get('/campaigns', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM campaigns ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CAMPAIGNS - CREATE
router.post('/campaigns', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { name, bonus_coins, condition_type, condition_value, is_active } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO campaigns (name, bonus_coins, condition_type, condition_value, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, bonus_coins, condition_type, condition_value, is_active !== false]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CAMPAIGNS - TOGGLE
router.patch('/campaigns/:id/toggle', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        await db.query('UPDATE campaigns SET is_active = $1 WHERE id = $2', [req.body.is_active, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CAMPAIGNS - DELETE
router.delete('/campaigns/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        await db.query('DELETE FROM campaigns WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MESSAGE SCHEDULES - GET
router.get('/message-schedules', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM message_schedules ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MESSAGE SCHEDULES - CREATE
router.post('/message-schedules', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { operator_id, message_template, send_at_hour, send_at_minute, days_of_week, target, is_active } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO message_schedules (operator_id, message_template, send_at_hour, send_at_minute, days_of_week, target, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [operator_id, message_template, send_at_hour, send_at_minute, days_of_week, target || 'all', is_active !== false]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MESSAGE SCHEDULES - TOGGLE
router.patch('/message-schedules/:id/toggle', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        await db.query('UPDATE message_schedules SET is_active = $1 WHERE id = $2', [req.body.is_active, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MESSAGE SCHEDULES - DELETE
router.delete('/message-schedules/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        await db.query('DELETE FROM message_schedules WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MAINTENANCE - STATS
router.get('/maintenance/stats', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const dbSize = await db.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size");
        const tableCounts = await db.query(`
            SELECT schemaname, tablename, n_live_tup as row_count
            FROM pg_stat_user_tables ORDER BY n_live_tup DESC
        `);
        res.json({ db_size: dbSize.rows[0].size, tables: tableCounts.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// QUICK REPLIES - GET
router.get('/quick-replies', authenticateToken, authorizeRole('admin', 'super_admin', 'operator'), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM quick_replies ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// QUICK REPLIES - CREATE
router.post('/quick-replies', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { title, content } = req.body;
    try {
        const result = await db.query('INSERT INTO quick_replies (title, content) VALUES ($1, $2) RETURNING *', [title, content]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// QUICK REPLIES - UPDATE
router.put('/quick-replies/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;
    try {
        const result = await db.query('UPDATE quick_replies SET title = $1, content = $2 WHERE id = $3 RETURNING *', [title, content, id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Mesaj bulunamadı.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// QUICK REPLIES - DELETE
router.delete('/quick-replies/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        await db.query('DELETE FROM quick_replies WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// REPORTS - GET
router.get('/reports', authenticateToken, authorizeRole('admin', 'super_admin', 'moderator'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT r.*, u1.username as reporter_name, u2.username as reported_name
            FROM reports r LEFT JOIN users u1 ON r.reporter_id = u1.id LEFT JOIN users u2 ON r.reported_id = u2.id
            ORDER BY r.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// REPORTS - UPDATE
router.put('/reports/:id', authenticateToken, authorizeRole('admin', 'super_admin', 'moderator'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const result = await db.query('UPDATE reports SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GIFTS - GET
router.get('/gifts', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM gifts ORDER BY cost ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GIFTS - CREATE
router.post('/gifts', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { name, cost, icon_url } = req.body;
    try {
        const result = await db.query('INSERT INTO gifts (name, cost, icon_url) VALUES ($1, $2, $3) RETURNING *', [name, cost, icon_url]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GIFTS - UPDATE
router.put('/gifts/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { name, cost, icon_url } = req.body;
    try {
        const result = await db.query('UPDATE gifts SET name = $1, cost = $2, icon_url = $3 WHERE id = $4 RETURNING *', [name, cost, icon_url, id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Hediye bulunamadı.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GIFTS - DELETE
router.delete('/gifts/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        await db.query('DELETE FROM gifts WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// FIX GENDERS
router.get('/fix-genders', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const MALE_NAMES = ['Mustafa', 'Furkan', 'Ahmet', 'Mehmet', 'Ali', 'Veli', 'Can', 'Murat', 'Hakan', 'Emre', 'Burak', 'Volkan', 'Gökhan', 'Serkan', 'Ömer', 'Osman', 'İbrahim', 'Halil', 'Ramadan', 'Ramazan', 'Fırat', 'Mert', 'Yiğit', 'Arda'];
        const FEMALE_NAMES = ['Ayşe', 'Fatma', 'Su', 'Esma', 'Emriye', 'Zeynep', 'Elif', 'Merve', 'Selin', 'Ece', 'Aslı', 'Deniz', 'Güneş', 'Buse', 'Hazal', 'Simge', 'İrem', 'Ceren', 'Ada', 'Dilara', 'Bahar'];
        let maleCount = 0, femaleCount = 0;
        for (const name of MALE_NAMES) {
            const r = await db.query("UPDATE users SET gender = 'erkek' WHERE (display_name ILIKE $1 OR username ILIKE $1) AND gender != 'erkek' AND gender != 'coin_bayisi'", [`%${name}%`]);
            maleCount += r.rowCount;
        }
        for (const name of FEMALE_NAMES) {
            const r = await db.query("UPDATE users SET gender = 'kadin' WHERE (display_name ILIKE $1 OR username ILIKE $1) AND gender != 'kadin' AND gender != 'coin_bayisi'", [`%${name}%`]);
            femaleCount += r.rowCount;
        }
        res.json({ message: 'Genders fixed', updated_male: maleCount, updated_female: femaleCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SCHEMA DUMP
router.get('/schema-dump', async (req, res) => {
    try {
        const tables = ['users', 'chats', 'messages', 'operators', 'commission_logs', 'agencies', 'operator_stats'];
        const dump = {};
        for (const table of tables) {
            const columns = await db.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1', [table]);
            dump[table] = columns.rows;
        }
        res.json(dump);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DEBUG LOGS
router.get('/debug-logs', (req, res) => { res.json(global.payoutLogs || []); });
router.get('/clear-logs', (req, res) => { global.payoutLogs = []; res.json({ success: true }); });

module.exports = router;
