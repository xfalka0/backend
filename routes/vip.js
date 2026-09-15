const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getVipLevel, getVipProgress } = require('../utils/vipUtils');
const { logActivity } = require('../utils/helpers');

// VIP XP PURCHASE ENDPOINT
// User spends coins to gain VIP XP (1 coin = 1 XP)
router.post('/purchase-xp', authenticateToken, async (req, res) => {
    const { coins } = req.body;
    const userId = req.user.id;

    try {
        // Validate input
        if (!coins || coins <= 0) {
            return res.status(400).json({ error: 'Geçersiz coin miktarı.' });
        }

        // Get user's current balance and vip_xp
        const userResult = await db.query('SELECT balance, vip_xp FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const user = userResult.rows[0];
        const currentBalance = user.balance || 0;
        const currentVipXp = user.vip_xp || 0;

        // Check if user has enough coins
        if (currentBalance < coins) {
            return res.status(400).json({
                error: 'Yetersiz bakiye.',
                required: coins,
                available: currentBalance
            });
        }

        // Calculate new values
        const newBalance = currentBalance - coins;
        const newVipXp = currentVipXp + coins; // 1:1 conversion
        const oldVipLevel = getVipLevel(currentVipXp);
        const newVipLevel = getVipLevel(newVipXp);
        const leveledUp = newVipLevel > oldVipLevel;

        // Update user
        await db.query(
            'UPDATE users SET balance = $1, vip_xp = $2 WHERE id = $3',
            [newBalance, newVipXp, userId]
        );

        // Log activity
        logActivity(userId, 'vip_xp_purchase', `${coins} coin harcayarak ${coins} VIP XP kazandı.`);

        // Get progress info
        const progress = getVipProgress(newVipXp);

        res.json({
            success: true,
            coinsSpent: coins,
            newBalance,
            newVipXp,
            oldVipLevel,
            newVipLevel,
            leveledUp,
            progress
        });

    } catch (err) {
        console.error('VIP XP Purchase Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET VIP PROGRESS
// Returns user's current VIP level and progress to next level
router.get('/progress', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const userResult = await db.query('SELECT vip_xp FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const vipXp = userResult.rows[0].vip_xp || 0;
        const progress = getVipProgress(vipXp);

        res.json(progress);

    } catch (err) {
        console.error('VIP Progress Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PREMIUM UPGRADE DIRECT
// Mobile app calls this when purchase is successful
router.post('/upgrade-direct', authenticateToken, async (req, res) => {
    const { months, transactionId } = req.body;
    const userId = req.user.id;
    
    try {
        if (!months || months <= 0) {
            return res.status(400).json({ error: 'Geçersiz süre.' });
        }
        
        // Add months to current expire date or from now
        const userRes = await db.query('SELECT vip_expire_date, is_vip FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }
        
        const user = userRes.rows[0];
        let baseDate = new Date();
        
        if (user.is_vip && user.vip_expire_date && new Date(user.vip_expire_date) > baseDate) {
            baseDate = new Date(user.vip_expire_date);
        }
        
        // Add months
        baseDate.setMonth(baseDate.getMonth() + months);
        
        // Update user
        await db.query(
            'UPDATE users SET is_vip = true, vip_expire_date = $1 WHERE id = $2',
            [baseDate, userId]
        );
        
        logActivity(userId, 'premium_upgrade', `${months} aylık premium satın aldı. (Tx: ${transactionId})`);
        
        res.json({
            success: true,
            is_vip: true,
            vip_expire_date: baseDate
        });
        
    } catch (err) {
        console.error('Premium Upgrade Error:', err.message);
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

module.exports = router;
