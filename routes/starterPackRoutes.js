const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Starter Pack config — edit freely
const STARTER_PACK = {
    coins: 300,          // Kullanıcıya verilecek coin
    price: 199.99,       // Gerçek fiyat (gösterim için)
    discounted_price: 99.99, // İndirimli fiyat
    discount_percent: 50,    // %50 indirim
    label: 'Hoşgeldin Paketi',
    description: 'Sadece sana özel, 1 kez kullanılabilir başlangıç fırsatı!'
};

// Ensure starter_pack_purchases table exists
const ensureTable = async () => {
    await db.query(`
        CREATE TABLE IF NOT EXISTS starter_pack_purchases (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            purchased_at TIMESTAMP DEFAULT NOW(),
            coins_received INTEGER NOT NULL,
            UNIQUE(user_id)
        )
    `);
};
ensureTable().catch(console.error);

// GET /api/starter-pack/check
// Check if user is eligible for the starter pack
router.get('/check', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id.toString();

        // Already purchased?
        const existing = await db.query(
            'SELECT purchased_at FROM starter_pack_purchases WHERE user_id = $1',
            [userId]
        );

        if (existing.rows.length > 0) {
            return res.json({ eligible: false, reason: 'already_purchased' });
        }

        // Get user balance and total_spent
        const userRes = await db.query(
            'SELECT balance, total_spent FROM users WHERE id = $1',
            [userId]
        );
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const { balance, total_spent } = userRes.rows[0];

        // Only show if total_spent is 0 (never bought) AND balance is low (< 50 coins)
        const totalSpent = parseFloat(total_spent || 0);
        const currentBalance = parseInt(balance || 0);

        if (totalSpent > 0) {
            return res.json({ eligible: false, reason: 'not_first_time' });
        }

        res.json({
            eligible: true,
            pack: STARTER_PACK,
            current_balance: currentBalance
        });
    } catch (err) {
        console.error('[STARTER PACK] Check error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/starter-pack/purchase
// Simulate purchase (RevenueCat handles real payment, this updates DB)
router.post('/purchase', authenticateToken, async (req, res) => {
    const userId = req.user.id.toString();
    const { transactionId } = req.body;

    try {
        await db.query('BEGIN');

        // Double-check eligibility
        const existing = await db.query(
            'SELECT id FROM starter_pack_purchases WHERE user_id = $1',
            [userId]
        );
        if (existing.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Bu paketi daha önce satın aldınız.' });
        }

        // Add coins
        const updateRes = await db.query(
            `UPDATE users SET balance = COALESCE(balance, 0) + $1,
             total_spent = COALESCE(total_spent, 0) + $2
             WHERE id = $3 RETURNING balance`,
            [STARTER_PACK.coins, STARTER_PACK.discounted_price, userId]
        );
        if (updateRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        // Record purchase
        await db.query(
            'INSERT INTO starter_pack_purchases (user_id, coins_received) VALUES ($1, $2)',
            [userId, STARTER_PACK.coins]
        );

        // Record transaction
        await db.query(
            'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
            [userId, STARTER_PACK.coins, 'starter_pack', `${STARTER_PACK.label} - Başlangıç Paketi`]
        );

        await db.query('COMMIT');

        const newBalance = updateRes.rows[0].balance;

        // Emit balance update
        const io = req.app.get('io');
        if (io) io.emit('balance_update', { userId, newBalance });

        console.log(`[STARTER PACK] User ${userId} purchased starter pack. New balance: ${newBalance}`);

        res.json({
            success: true,
            coins_added: STARTER_PACK.coins,
            new_balance: newBalance,
            message: `${STARTER_PACK.coins} coin hesabınıza eklendi!`
        });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('[STARTER PACK] Purchase error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
