const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Activate Boost for 24 hours (1440 minutes)
router.post('/:userId', async (req, res) => {
    const { userId } = req.params;
    let { durationMinutes = 1440, cost = 1000 } = req.body; // Default 1 day, 1000 coins

    durationMinutes = parseInt(durationMinutes, 10) || 1440;

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

        // Check if already boosted to extend, or just insert new
        // A simple approach is just insert a new one, and the discovery logic uses the latest end_time
        const boostRes = await pool.query(`
            INSERT INTO boosts (user_id, start_time, end_time) 
            VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + ($2 * interval '1 minute'))
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
        res.status(500).json({ error: 'DB Error: ' + err.message + ' | ' + (err.detail || '') });
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

// Claim Free Daily VIP Boost
router.post('/claim-free-boost', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        await pool.query('BEGIN');

        // 1. Fetch user's VIP level
        const userRes = await pool.query('SELECT vip_level FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const vipLevel = parseInt(userRes.rows[0].vip_level || 0, 10);
        if (vipLevel < 1) {
            await pool.query('ROLLBACK');
            return res.status(403).json({ error: 'Bu özellikten yararlanmak için en az VIP 1 olmalısınız.' });
        }

        // Determine limits
        let dailyLimit = 0;
        if (vipLevel === 1) dailyLimit = 1;
        else if (vipLevel === 2) dailyLimit = 2;
        else if (vipLevel === 3) dailyLimit = 3;
        else if (vipLevel === 4) dailyLimit = 5;
        else if (vipLevel === 5) dailyLimit = 8;
        else if (vipLevel >= 6) dailyLimit = 12;

        // 2. Count claims today
        const claimCountRes = await pool.query(`
            SELECT COUNT(*)::int 
            FROM daily_vip_boost_claims 
            WHERE user_id = $1 AND claimed_at >= CURRENT_DATE
        `, [userId]);

        const claimsToday = claimCountRes.rows[0].count;
        if (claimsToday >= dailyLimit) {
            await pool.query('ROLLBACK');
            return res.status(400).json({ error: 'Bugün için ücretsiz VIP boost limitinize ulaştınız.' });
        }

        // 3. Insert mini-boost (30 minutes)
        const boostDurationMinutes = 30;
        const boostRes = await pool.query(`
            INSERT INTO boosts (user_id, start_time, end_time) 
            VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + ($2 * interval '1 minute'))
            RETURNING end_time
        `, [userId, boostDurationMinutes]);

        // 4. Record claim
        await pool.query(`
            INSERT INTO daily_vip_boost_claims (user_id) 
            VALUES ($1)
        `, [userId]);

        await pool.query('COMMIT');

        res.json({
            success: true,
            message: `Ücretsiz VIP Öne Çıkarma aktifleşti! (Süre: ${boostDurationMinutes} dakika)`,
            endTime: boostRes.rows[0].end_time,
            claimsRemaining: dailyLimit - claimsToday - 1,
            totalLimit: dailyLimit
        });

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error('Claim Free Boost Error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// Check daily free boost claim status
router.get('/free-claims-status/:userId', authenticateToken, async (req, res) => {
    const { userId } = req.params;
    try {
        const userRes = await pool.query('SELECT vip_level FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const vipLevel = parseInt(userRes.rows[0].vip_level || 0, 10);
        let dailyLimit = 0;
        if (vipLevel === 1) dailyLimit = 1;
        else if (vipLevel === 2) dailyLimit = 2;
        else if (vipLevel === 3) dailyLimit = 3;
        else if (vipLevel === 4) dailyLimit = 5;
        else if (vipLevel === 5) dailyLimit = 8;
        else if (vipLevel >= 6) dailyLimit = 12;

        const claimCountRes = await pool.query(`
            SELECT COUNT(*)::int 
            FROM daily_vip_boost_claims 
            WHERE user_id = $1 AND claimed_at >= CURRENT_DATE
        `, [userId]);

        const claimsToday = claimCountRes.rows[0].count;

        res.json({
            vipLevel,
            claimsToday,
            dailyLimit,
            claimsRemaining: Math.max(0, dailyLimit - claimsToday)
        });
    } catch (err) {
        console.error('Get Free Claims Status Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
