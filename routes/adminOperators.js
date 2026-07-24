const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { sanitizeUser, MALE_NAME_PATTERN } = require('../utils/helpers');
const { initiatePayout } = require('../utils/payermax');

// GET ALL OPERATORS (Public listing)
router.get('/', async (req, res) => {
    try {
        const { gender, page = 1, limit = 100, tab = 'Önerilen' } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.max(1, parseInt(limit) || 10);
        const offset = (pageNum - 1) * limitNum;

        let query = `
            SELECT u.id, COALESCE(u.display_name, u.username) as name,
                u.avatar_url, u.gender, u.age, u.vip_level, u.job, u.relationship, u.zodiac, u.interests, u.role, u.boy,
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
        else orderByClause = 'ORDER BY o.is_online DESC NULLS LAST, (coalesce(cardinality(o.photos), 0) > 0) DESC, u.created_at DESC, u.id DESC';

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

        const randomBoy = (gender === 'kadin' || !gender) ? String(Math.floor(Math.random() * (170 - 155 + 1)) + 155) : '175';
        const CITIES = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Kocaeli', 'Gaziantep', 'Eskişehir', 'Muğla', 'Trabzon', 'Samsun', 'Aydın', 'Denizli', 'Balkesir', 'Mersin', 'Kayseri', 'Sakarya'];
        const randomCity = CITIES[Math.floor(Math.random() * CITIES.length)];

        const userResult = await db.query(
            `INSERT INTO users (username, email, password, password_hash, role, display_name, name, gender, age, avatar_url, job, relationship, zodiac, interests, vip_level, boy, city, account_status)
             VALUES ($1, $2, $3, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active') RETURNING id`,
            [username, email, dummyPassword, 'operator', name, gender || 'kadin', parseInt(age) || 18, avatar_url,
             job || null, relationship || null, zodiac || null, interests || '[]', parseInt(vip_level) || 0, randomBoy, randomCity]
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
            SELECT 
                (SELECT COALESCE(SUM(amount), 0) FROM payouts WHERE status = 'pending') as total_pending_payouts,
                (SELECT COALESCE(SUM(pending_balance), 0) FROM operators) as total_operator_balances,
                (SELECT COALESCE(SUM(amount), 0) FROM payouts WHERE status = 'processed') as total_paid,
                (SELECT COALESCE(SUM(lifetime_earnings), 0) FROM operators) as total_lifetime
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

        // Self-healing provisioning of operators record for seamless onboarding
        const checkOp = await db.query('SELECT 1 FROM operators WHERE user_id = $1', [userId]);
        if (checkOp.rows.length === 0) {
            await db.query(
                `INSERT INTO operators (user_id, pending_balance, lifetime_earnings, is_online, rating, category, bio)
                 VALUES ($1, 0, 0, true, 5.0, 'Genel', 'Merhaba!')
                 ON CONFLICT (user_id) DO NOTHING`,
                [userId]
            );
        }

        const query = `
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.role,
                COALESCE(o.pending_balance, 0) as pending_balance, COALESCE(o.lifetime_earnings, 0) as lifetime_earnings,
                COALESCE(o.commission_rate, 0.25) as commission_rate, o.last_payout_at, o.last_active_at,
                -- Today Stats
                (SELECT COALESCE(SUM(coins_earned), 0) FROM operator_stats WHERE operator_id::text = $1::text AND date = CURRENT_DATE) as earned_today,
                (SELECT COALESCE(SUM(messages_sent), 0) FROM operator_stats WHERE operator_id::text = $1::text AND date = CURRENT_DATE) as messages_sent,
                (SELECT COALESCE(SUM(image_count), 0) FROM operator_stats WHERE operator_id::text = $1::text AND date = CURRENT_DATE) as image_count,
                (SELECT COALESCE(SUM(gift_count), 0) FROM operator_stats WHERE operator_id::text = $1::text AND date = CURRENT_DATE) as gift_count,
                (SELECT COALESCE(SUM(coins_earned), 0) FROM operator_stats WHERE operator_id::text = $1::text AND date = CURRENT_DATE) as coins_earned,
                -- Global Stats
                (SELECT COALESCE(SUM(messages_sent), 0) FROM operator_stats WHERE operator_id::text = $1::text) as total_messages
            FROM users u
            LEFT JOIN operators o ON u.id::text = o.user_id::text
            WHERE u.id::text = $1::text
        `;
        const result = await db.query(query, [userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Stats not found' });
        const weeklyRes = await db.query(`
            SELECT date, messages_sent, coins_earned, text_count, image_count, audio_count, gift_count FROM operator_stats
            WHERE operator_id::text = $1::text AND date >= CURRENT_DATE - INTERVAL '7 days' ORDER BY date DESC
        `, [userId]);
        res.json({ ...result.rows[0], weekly_stats: weeklyRes.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE WITHDRAWAL REQUEST (Operator)
router.post('/my/withdraw', authenticateToken, async (req, res) => {
    const { amount, iban, accountHolder } = req.body;
    const operatorId = req.user.id;

    try {
        const withdrawAmount = parseInt(amount);
        if (isNaN(withdrawAmount) || withdrawAmount < 10000) {
            return res.status(400).json({ error: 'Minimum çekim limiti 10.000 elmastır (5 USD).' });
        }

        // Validate IBAN: TR prefix and exactly 26 characters (or standard TR IBAN formatting)
        const cleanIban = (iban || '').replace(/\s+/g, '').toUpperCase();
        if (!cleanIban.startsWith('TR') || cleanIban.length !== 26) {
            return res.status(400).json({ error: 'Geçersiz IBAN formatı. TR ile başlayan 26 haneli bir IBAN girin.' });
        }

        if (!accountHolder || accountHolder.trim().length === 0) {
            return res.status(400).json({ error: 'Hesap sahibi adını girin.' });
        }

        await db.query('BEGIN');

        // Check pending balance inside transaction with FOR UPDATE locking for race condition prevention
        const opRes = await db.query('SELECT pending_balance FROM operators WHERE user_id = $1 FOR UPDATE', [operatorId]);
        if (opRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Operatör kaydı bulunamadı.' });
        }

        const pending = parseFloat(opRes.rows[0].pending_balance || 0);
        if (pending < withdrawAmount) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: `Yetersiz bakiye. Mevcut bakiyeniz: ${pending.toLocaleString()} elmas.` });
        }

        // 2000 Diamonds = 1 USD (47.35 TL exchange rate)
        const usdValue = withdrawAmount / 2000;
        const exchangeRate = 47.35;
        const cashAmount = usdValue * exchangeRate;

        // Insert pending payout request and deduct the amount immediately
        await db.query(
            `INSERT INTO payouts (operator_id, amount, status, payment_method, iban, account_holder, cash_amount, exchange_rate)
             VALUES ($1, $2, 'pending', 'IBAN', $3, $4, $5, $6)`,
            [operatorId, withdrawAmount, cleanIban, accountHolder.trim(), cashAmount, exchangeRate]
        );

        await db.query(
            'UPDATE operators SET pending_balance = pending_balance - $1 WHERE user_id = $2',
            [withdrawAmount, operatorId]
        );

        await db.query('COMMIT');
        res.json({ success: true, message: 'Çekim talebiniz başarıyla alındı. Yönetici tarafından inceleniyor.' });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error('[WITHDRAWAL-ERROR]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET MY WITHDRAWAL HISTORY (Operator)
router.get('/my/withdrawals', authenticateToken, async (req, res) => {
    const operatorId = req.user.id;
    try {
        const result = await db.query(
            `SELECT id, amount, status, iban, account_holder, cash_amount, exchange_rate, rejection_reason, created_at, processed_at
             FROM payouts 
             WHERE operator_id = $1 
             ORDER BY created_at DESC`,
            [operatorId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// EXCHANGE DIAMONDS TO MESSAGE COINS (Operator/Female user)
router.post('/my/exchange-coins', authenticateToken, async (req, res) => {
    const { amount, coins } = req.body;
    const userId = req.user.id;

    try {
        const diamondAmount = parseInt(amount);
        const coinAmount = parseInt(coins);

        if (isNaN(diamondAmount) || diamondAmount <= 0 || isNaN(coinAmount) || coinAmount <= 0) {
            return res.status(400).json({ error: 'Geçersiz elmas veya altın para tutarı.' });
        }

        await db.query('BEGIN');

        // Check pending balance lock
        const opRes = await db.query('SELECT pending_balance FROM operators WHERE user_id = $1 FOR UPDATE', [userId]);
        if (opRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Kullanıcı cüzdanı bulunamadı.' });
        }

        const pending = parseFloat(opRes.rows[0].pending_balance || 0);
        if (pending < diamondAmount) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Yetersiz bakiye.' });
        }

        // Deduct diamonds from operator's pending_balance
        await db.query(
            'UPDATE operators SET pending_balance = pending_balance - $1 WHERE user_id = $2',
            [diamondAmount, userId]
        );

        // Add coins to user's balance in users table
        await db.query(
            'UPDATE users SET balance = balance + $1 WHERE id = $2',
            [coinAmount, userId]
        );

        // Record transaction log for the coin deposit
        await db.query(
            `INSERT INTO transactions (user_id, amount, type, description)
             VALUES ($1, $2, 'bonus', $3)`,
            [userId, coinAmount, `${diamondAmount} Elmas takası ile gelen altın para (+ bonus)`]
        );

        await db.query('COMMIT');
        res.json({ success: true, newBalance: pending - diamondAmount });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error('[EXCHANGE-ERROR]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET PENDING/ALL PAYOUT REQUESTS FOR ADMIN (Admin)
router.get('/admin/withdrawals/list', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { status } = req.query; // pending, processed, rejected
    try {
        let query = `
            SELECT p.id, p.amount, p.status, p.iban, p.account_holder, p.cash_amount, p.exchange_rate, p.rejection_reason, p.created_at, p.processed_at,
                   u.username, u.display_name, u.avatar_url
            FROM payouts p
            JOIN users u ON p.operator_id = u.id
        `;
        let params = [];
        if (status) {
            query += ` WHERE p.status = $1`;
            params.push(status);
        }
        query += ` ORDER BY p.created_at DESC`;

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// APPROVE WITHDRAWAL REQUEST (Admin)
router.post('/admin/payouts/:payoutId/approve', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { payoutId } = req.params;
    try {
        await db.query('BEGIN');

        // Check if request exists and is pending, select details for PayerMax
        const payoutRes = await db.query(
            'SELECT status, operator_id, amount, iban, account_holder, cash_amount FROM payouts WHERE id = $1 FOR UPDATE', 
            [payoutId]
        );
        
        if (payoutRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Ödeme talebi bulunamadı.' });
        }

        const payout = payoutRes.rows[0];
        if (payout.status !== 'pending') {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: `Bu talep zaten işlem görmüş. Durumu: ${payout.status}` });
        }

        // Call PayerMax to automate disbursement
        const payermaxRes = await initiatePayout({
            payoutId: payoutId,
            amountTry: payout.cash_amount,
            iban: payout.iban,
            accountHolder: payout.account_holder
        });

        if (!payermaxRes.success) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: payermaxRes.message });
        }

        // Payout succeeded via PayerMax, update status and store PayerMax order details
        await db.query(
            `UPDATE payouts 
             SET status = 'processed', 
                 processed_at = NOW(),
                 payermax_order_no = $2,
                 payment_details = $3
             WHERE id = $1`,
            [payoutId, payermaxRes.transactionId || null, JSON.stringify(payermaxRes)]
        );

        // Also increase operator lifetime earnings
        await db.query(
            `UPDATE operators 
             SET lifetime_earnings = lifetime_earnings + $1, last_payout_at = NOW() 
             WHERE user_id = $2`,
            [payout.amount, payout.operator_id]
        );

        await db.query('COMMIT');
        res.json({ 
            success: true, 
            message: `Ödeme talebi başarıyla onaylandı ve PayerMax üzerinden otomatik olarak ödendi. ${payermaxRes.transactionId ? '(PayerMax No: ' + payermaxRes.transactionId + ')' : ''}` 
        });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error('[APPROVE-PAYOUT-ERROR]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// REJECT WITHDRAWAL REQUEST (Admin)
router.post('/admin/payouts/:payoutId/reject', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { payoutId } = req.params;
    const { reason } = req.body;

    try {
        await db.query('BEGIN');

        // Check if request exists and is pending
        const payoutRes = await db.query('SELECT status, operator_id, amount FROM payouts WHERE id = $1 FOR UPDATE', [payoutId]);
        if (payoutRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Ödeme talebi bulunamadı.' });
        }

        const payout = payoutRes.rows[0];
        if (payout.status !== 'pending') {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: `Bu talep zaten işlem görmüş. Durumu: ${payout.status}` });
        }

        // Reject request, log reason
        await db.query(
            `UPDATE payouts 
             SET status = 'rejected', rejection_reason = $2, processed_at = NOW() 
             WHERE id = $1`,
            [payoutId, reason || 'Yönetici tarafından reddedildi.']
        );

        // Refund Diamonds back to operator's pending balance
        await db.query(
            `UPDATE operators 
             SET pending_balance = pending_balance + $1 
             WHERE user_id = $2`,
            [payout.amount, payout.operator_id]
        );

        await db.query('COMMIT');
        res.json({ success: true, message: 'Ödeme talebi reddedildi ve elmaslar iade edildi.' });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error('[REJECT-PAYOUT-ERROR]', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
