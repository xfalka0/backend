const express = require('express');
const router = express.Router();
const db = require('../db');
const { getVipLevel, VIP_THRESHOLDS } = require('../utils/vipUtils');

// RevenueCat Webhook Secret (Should be in .env)
const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

// Webhook endpoint for RevenueCat events
router.post('/revenuecat', async (req, res) => {
    const { event } = req.body;

    // Security check: Verify Authorization header if secret is set
    if (WEBHOOK_SECRET && req.headers.authorization !== `Bearer ${WEBHOOK_SECRET}`) {
        console.warn('[WEBHOOK] Unauthorized revenuecat event');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!event) return res.status(400).json({ error: 'No event data' });

    console.log(`[PAYMENT] Received event: ${event.type} for App User ID: ${event.app_user_id}`);

    try {
        const userId = event.app_user_id;
        const io = req.app.get('io');

        switch (event.type) {
            case 'INITIAL_PURCHASE':
            case 'RENEWAL':
            case 'NON_RENEWING_PURCHASE':
                await handleSuccessfulPayment(userId, event, io);
                break;
            case 'CANCELLATION':
            case 'EXPIRATION':
                // Optional: handle subscription expiration
                console.log(`[PAYMENT] User ${userId} subscription expired/cancelled`);
                break;
            default:
                console.log(`[PAYMENT] Unhandled event type: ${event.type}`);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[WEBHOOK ERROR]', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

async function handleSuccessfulPayment(userId, event, io) {
    const productId = event.product_id || event.productId;
    const transactionId = event.transaction_id || event.id || `rc_${Date.now()}`;

    // Mapping RevenueCat product IDs to coin amounts
    const productMapping = {
        'coins_100': 100,
        'coins_200': 200,
        'coins_400': 400,
        'coins_700': 700,
        'coins_1200': 1200,
        'coins_2500': 2500,
        'coins_5000': 5000
    };

    let coinAmount = productMapping[productId];

    // Try to extract amount dynamically if exact match fails (e.g. coins_5000_v1, coins_10000_v1)
    if (!coinAmount && productId && productId.includes('coins_')) {
        const match = productId.match(/coins_(\d+)/);
        if (match) {
            coinAmount = parseInt(match[1], 10);
            console.log(`[WEBHOOK] Dynamically mapped ${productId} to ${coinAmount} coins.`);
        }
    }

    if (coinAmount) {
        try {
            await db.query('BEGIN');
            const existingTx = await db.query('SELECT id FROM payments WHERE transaction_id = $1', [transactionId]);
            if (existingTx.rows.length === 0) {
                // Fetch current user balance and VIP info
                const userRes = await db.query('SELECT balance, vip_xp, vip_level FROM users WHERE id = $1 FOR UPDATE', [userId]);
                if (userRes.rows.length > 0) {
                    const currentBalance = parseInt(userRes.rows[0].balance) || 0;
                    const currentVipXp = parseInt(userRes.rows[0].vip_xp) || 0;
                    const currentVipLevel = parseInt(userRes.rows[0].vip_level) || 0;

                    const newBalance = currentBalance + coinAmount;
                    const newVipXp = currentVipXp + coinAmount; // 1 coin = 1 VIP XP
                    const calculatedLevel = getVipLevel(newVipXp);
                    const newVipLevel = Math.max(currentVipLevel, calculatedLevel);
                    const isVip = newVipLevel > 0;

                    await db.query(
                        'UPDATE users SET balance = $1, vip_xp = $2, vip_level = $3, is_vip = $4 WHERE id = $5',
                        [newBalance, newVipXp, newVipLevel, isVip, userId]
                    );

                    await db.query('INSERT INTO payments (user_id, transaction_id, amount, status) VALUES ($1, $2, $3, $4)',
                        [userId, transactionId, coinAmount, 'completed']);
                    await db.query('INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
                        [userId, coinAmount, 'webhook_purchase', `RevenueCat webhook: ${productId}`]);

                    console.log(`[WEBHOOK SUCCESS] Added ${coinAmount} coins & XP to user ${userId} (New VIP: ${newVipLevel}, New XP: ${newVipXp}) for tx ${transactionId}`);

                    if (io) {
                        io.to(`user_${userId}`).emit('balance_update', {
                            balance: newBalance,
                            hearts: newBalance,
                            vip_level: newVipLevel,
                            vip_xp: newVipXp
                        });
                        if (newVipLevel > currentVipLevel) {
                            io.to(`user_${userId}`).emit('vip_level_up', {
                                vip_level: newVipLevel,
                                old_vip_level: currentVipLevel,
                                vip_xp: newVipXp
                            });
                        }
                    }
                }
            } else {
                console.log(`[WEBHOOK DUPLICATE] Transaction ${transactionId} already processed.`);
            }
            await db.query('COMMIT');
        } catch (err) {
            await db.query('ROLLBACK');
            console.error('[WEBHOOK PAYMENT ERROR]', err.message);
        }
    } else if (productId && (productId.includes('vip_level_') || productId.includes('vip_'))) {
        try {
            const match = productId.match(/vip(?:_level)?_(\d+)/);
            if (match) {
                const targetLevel = parseInt(match[1], 10);
                if (targetLevel >= 1 && targetLevel <= 6) {
                    const minXp = VIP_THRESHOLDS[targetLevel] || 100;
                    await db.query(
                        'UPDATE users SET vip_level = GREATEST(COALESCE(vip_level, 0), $1), vip_xp = GREATEST(COALESCE(vip_xp, 0), $2), is_vip = true WHERE id = $3',
                        [targetLevel, minXp, userId]
                    );
                    if (io) {
                        io.to(`user_${userId}`).emit('vip_level_up', { vip_level: targetLevel, vip_xp: minXp });
                    }
                }
            }
        } catch (vipErr) {
            console.error('[WEBHOOK VIP DIRECT ERROR]', vipErr.message);
        }
    } else {
        console.warn(`[WEBHOOK] Unhandled product ID mapping: ${productId}`);
    }
}

module.exports = router;
