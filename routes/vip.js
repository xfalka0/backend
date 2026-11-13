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
            'UPDATE users SET balance = $1, vip_xp = $2, vip_level = GREATEST(COALESCE(vip_level, 0), $3), is_vip = true WHERE id = $4',
            [newBalance, newVipXp, newVipLevel, userId]
        );

        // Socket IO update
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${userId}`).emit('balance_update', {
                balance: newBalance,
                hearts: newBalance,
                vip_level: newVipLevel,
                vip_xp: newVipXp
            });
            if (leveledUp) {
                io.to(`user_${userId}`).emit('vip_level_up', {
                    vip_level: newVipLevel,
                    old_vip_level: oldVipLevel,
                    vip_xp: newVipXp
                });
            }
        }

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
        const userResult = await db.query('SELECT vip_xp, vip_level, is_vip FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const user = userResult.rows[0];
        const vipXp = parseInt(user.vip_xp || 0, 10);
        const progress = getVipProgress(vipXp);
        const dbVipLevel = parseInt(user.vip_level || 0, 10);
        if (dbVipLevel > progress.currentLevel) {
            progress.currentLevel = dbVipLevel;
        }

        res.json({
            ...progress,
            vip_level: progress.currentLevel,
            is_vip: !!user.is_vip || progress.currentLevel > 0
        });

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
        const userRes = await db.query('SELECT premium_expire_date, vip_expire_date, is_premium, premium_start_date, vip_start_date FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }
        
        const user = userRes.rows[0];
        let baseDate = new Date();
        const existingExpire = user.premium_expire_date || user.vip_expire_date;
        let startDate = user.premium_start_date || user.vip_start_date || new Date();
        
        if (existingExpire && new Date(existingExpire) > baseDate) {
            baseDate = new Date(existingExpire);
        } else {
            startDate = new Date();
        }
        
        // Add months
        baseDate.setMonth(baseDate.getMonth() + months);
        
        // Update user: Premium is the subscription with start and expire dates
        await db.query(
            `UPDATE users 
             SET is_premium = true, 
                 premium_start_date = $1::timestamptz, 
                 premium_expire_date = $2::timestamptz,
                 vip_start_date = $1::timestamptz, 
                 vip_expire_date = $2::timestamp 
             WHERE id = $3`,
            [startDate, baseDate, userId]
        );
        
        logActivity(userId, 'premium_upgrade', `${months} aylık premium satın aldı. (Tx: ${transactionId})`);
        
        res.json({
            success: true,
            is_premium: true,
            premium_start_date: startDate,
            premium_expire_date: baseDate,
            vip_expire_date: baseDate
        });
        
    } catch (err) {
        console.error('Premium Upgrade Error:', err.message);
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

module.exports = router;
