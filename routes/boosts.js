const express = require('express');
const router = express.Router();
const pool = require('../db');

// Activate Boost for 30 minutes
router.post('/:userId', async (req, res) => {
    const { userId } = req.params;
    const { durationMinutes = 30, cost = 100 } = req.body; // Default 30 mins, 100 coins

    try {
        await pool.query('BEGIN');

        // Check if user has enough balance
        const userRes = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found' });
        }

        const balance = userRes.rows[0].balance;
        if (balance < cost) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ error: 'Bakiye yetersiz. Öne çıkmak için daha fazla Coin satın almalısınız.', insufficientFunds: true });
        }

        // Deduct balance
        await pool.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [cost, userId]);

        // Record transaction
        await pool.query(
            'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
            [userId, -cost, 'spend_boost', 'Profil Öne Çıkarma (Boost)']
        );

        // Check if already boosted to extend, or just insert new
        // A simple approach is just insert a new one, and the discovery logic uses the latest end_time
        const boostRes = await pool.query(`
            INSERT INTO boosts (user_id, start_time, end_time) 
            VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + ($2 || ' minutes')::interval)
            RETURNING end_time
        `, [userId, durationMinutes]);

        await pool.query('COMMIT');

        res.status(200).json({
            message: 'Profilin başarıyla öne çıkarıldı!',
            endTime: boostRes.rows[0].end_time,
            newBalance: balance - cost
        });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Activate Boost Error:', err);
        res.status(500).json({ error: 'Server error while activating boost' });
    }
});

// Check if user is currently boosted
router.get('/status/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const boostCheck = await pool.query(`
            SELECT end_time 
            FROM boosts 
            WHERE user_id = $1 AND end_time > CURRENT_TIMESTAMP
            ORDER BY end_time DESC
            LIMIT 1
        `, [userId]);

        if (boostCheck.rows.length > 0) {
            res.json({ isBoosted: true, endTime: boostCheck.rows[0].end_time });
        } else {
            res.json({ isBoosted: false });
        }
    } catch (err) {
        console.error('Check Boost Status Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
