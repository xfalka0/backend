const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { getVipLevel, VIP_THRESHOLDS } = require('../utils/vipUtils');

// Server-side product catalogs (fixed truth source)
const COIN_PRODUCT_MAPPING = {
    'coins_100': 100,
    'coins_200': 200,
    'coins_400': 400,
    'coins_700': 700,
    'coins_1200': 1200,
    'coins_2500': 2500,
    'coins_5000': 5000
};

const VIP_PRODUCT_MAPPING = {
    'premium_1_month': 1,
    'premium_3_months': 3,
    'premium_6_months': 6,
    'vip_1_month': 1,
    'vip_3_months': 3,
    'vip_6_months': 6
};

// Webhook endpoint for RevenueCat events
router.post('/revenuecat', async (req, res) => {
    const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

    // 1. FAIL CLOSED: Secret must be configured and non-empty
    if (!WEBHOOK_SECRET || typeof WEBHOOK_SECRET !== 'string' || WEBHOOK_SECRET.trim() === '') {
        console.error('[WEBHOOK ERROR] REVENUECAT_WEBHOOK_SECRET is not set in environment. Rejecting request (fail closed).');
        return res.status(401).json({ error: 'Unauthorized: Webhook secret not configured on server' });
    }

    // 2. TIMING-SAFE AUTH HEADER VERIFICATION
    const authHeader = req.headers.authorization || '';
    const expectedHeader = `Bearer ${WEBHOOK_SECRET}`;

    const authBuffer = Buffer.from(authHeader, 'utf8');
    const expectedBuffer = Buffer.from(expectedHeader, 'utf8');

    if (authBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(authBuffer, expectedBuffer)) {
        console.warn('[WEBHOOK] Unauthorized revenuecat event - invalid secret header');
        return res.status(401).json({ error: 'Unauthorized: Invalid webhook secret' });
    }

    const { event } = req.body;
    if (!event || !event.id) {
        return res.status(400).json({ error: 'Missing event payload or event id' });
    }

    const eventId = String(event.id);
    const userId = event.app_user_id;
    const productId = event.product_id || event.productId;

    console.log(`[PAYMENT] Received event: ${event.type} (id: ${eventId}) for App User ID: ${userId}, Product: ${productId}`);

    // 3. IDEMPOTENCY CHECK: Check if event_id already processed
    try {
        const dupCheck = await db.query(
            'SELECT id FROM processed_webhook_events WHERE event_id = $1',
            [eventId]
        );
        if (dupCheck.rows.length > 0) {
            console.log(`[WEBHOOK DUPLICATE] Event ${eventId} already processed. Skipping duplicate execution.`);
            return res.json({ success: true, duplicate: true, message: 'Event already processed' });
        }
    } catch (checkErr) {
        console.error('[WEBHOOK ERROR] Idempotency check failed:', checkErr.message);
        return res.status(500).json({ error: 'Database error during idempotency check' });
    }

    // 4. PROCESS EVENT TYPE
    try {
        const io = req.app.get('io');

        switch (event.type) {
            case 'INITIAL_PURCHASE':
            case 'RENEWAL':
            case 'NON_RENEWING_PURCHASE': {
                const processResult = await handleSuccessfulPayment(userId, event, io);
                if (!processResult.success) {
                    return res.status(processResult.statusCode || 400).json({ error: processResult.error });
                }
                break;
            }
            case 'CANCELLATION':
            case 'EXPIRATION':
                console.log(`[PAYMENT] User ${userId} subscription expired/cancelled`);
                break;
            default:
                console.log(`[PAYMENT] Ignored unhandled event type: ${event.type}`);
        }

        // Record in processed_webhook_events after successful handling
        await db.query(
            'INSERT INTO processed_webhook_events (event_id, app_user_id, event_type, product_id) VALUES ($1, $2, $3, $4) ON CONFLICT (event_id) DO NOTHING',
            [eventId, userId || null, event.type || null, productId || null]
        );

        return res.json({ success: true });
    } catch (err) {
        console.error('[WEBHOOK ERROR]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

async function handleSuccessfulPayment(userId, event, io) {
    const productId = event.product_id || event.productId;
    const transactionId = event.transaction_id || event.id || `rc_${Date.now()}`;

    if (!userId) {
        return { success: false, statusCode: 400, error: 'Missing app_user_id' };
    }

    // A) Check Coin Products
    if (COIN_PRODUCT_MAPPING.hasOwnProperty(productId)) {
        const coinAmount = COIN_PRODUCT_MAPPING[productId];
        try {
            await db.query('BEGIN');

            const existingTx = await db.query('SELECT id FROM payments WHERE transaction_id = $1', [transactionId]);
            if (existingTx.rows.length === 0) {
                const userRes = await db.query('SELECT balance, vip_xp, vip_level FROM users WHERE id::text = $1::text FOR UPDATE', [userId]);
                if (userRes.rows.length === 0) {
                    await db.query('ROLLBACK');
                    return { success: false, statusCode: 404, error: 'User not found' };
                }

                const currentBalance = parseInt(userRes.rows[0].balance, 10) || 0;
                const currentVipXp = parseInt(userRes.rows[0].vip_xp, 10) || 0;
                const currentVipLevel = parseInt(userRes.rows[0].vip_level, 10) || 0;

                const newBalance = currentBalance + coinAmount;
                const newVipXp = currentVipXp + coinAmount;
                const calculatedLevel = getVipLevel(newVipXp);
                const newVipLevel = Math.max(currentVipLevel, calculatedLevel);
                const isVip = newVipLevel > 0;

                await db.query(
                    'UPDATE users SET balance = $1, vip_xp = $2, vip_level = $3, is_vip = $4 WHERE id::text = $5::text',
                    [newBalance, newVipXp, newVipLevel, isVip, userId]
                );

                await db.query('INSERT INTO payments (user_id, transaction_id, amount, status) VALUES ($1, $2, $3, $4)',
                    [userId, transactionId, coinAmount, 'completed']);
                await db.query('INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
                    [userId, coinAmount, 'webhook_purchase', `RevenueCat webhook: ${productId}`]);

                console.log(`[WEBHOOK SUCCESS] Added ${coinAmount} coins to user ${userId} for tx ${transactionId}`);

                if (io) {
                    io.to(`user_${userId}`).emit('balance_update', {
                        balance: newBalance,
                        hearts: newBalance,
                        vip_level: newVipLevel,
                        vip_xp: newVipXp
                    });
                }
            }
            await db.query('COMMIT');
            return { success: true };
        } catch (err) {
            await db.query('ROLLBACK');
            console.error('[WEBHOOK PAYMENT ERROR]', err.message);
            return { success: false, statusCode: 500, error: err.message };
        }
    }

    // B) Check VIP Subscription Products
    if (VIP_PRODUCT_MAPPING.hasOwnProperty(productId)) {
        const months = VIP_PRODUCT_MAPPING[productId];
        try {
            await db.query('BEGIN');
            const userRes = await db.query(
                'SELECT vip_expire_date, is_vip, vip_level FROM users WHERE id::text = $1::text FOR UPDATE',
                [userId]
            );
            if (userRes.rows.length === 0) {
                await db.query('ROLLBACK');
                return { success: false, statusCode: 404, error: 'User not found' };
            }

            const user = userRes.rows[0];
            let baseDate = new Date();
            let startDate = user.vip_start_date || new Date();

            if (user.is_vip && user.vip_expire_date && new Date(user.vip_expire_date) > baseDate) {
                baseDate = new Date(user.vip_expire_date);
            } else {
                startDate = new Date();
            }

            baseDate.setMonth(baseDate.getMonth() + months);

            await db.query(
                `UPDATE users 
                 SET is_premium = true, 
                     premium_start_date = $1::timestamptz, 
                     premium_expire_date = $2::timestamptz, 
                     vip_start_date = $1::timestamptz, 
                     vip_expire_date = $2::timestamp 
                 WHERE id::text = $3::text`,
                [startDate, baseDate, userId]
            );

            await db.query('INSERT INTO payments (user_id, transaction_id, amount, status) VALUES ($1, $2, $3, $4)',
                [userId, transactionId, months, 'completed_vip']);

            await db.query('COMMIT');
            console.log(`[WEBHOOK VIP SUCCESS] Activated ${months} months VIP for user ${userId} until ${baseDate.toISOString()}`);

            if (io) {
                io.to(`user_${userId}`).emit('vip_level_up', {
                    is_vip: true,
                    vip_level: Math.max(user.vip_level || 0, 1),
                    vip_expire_date: baseDate
                });
            }
            return { success: true };
        } catch (vipErr) {
            await db.query('ROLLBACK');
            console.error('[WEBHOOK VIP ERROR]', vipErr.message);
            return { success: false, statusCode: 500, error: vipErr.message };
        }
    }

    // C) UNKNOWN PRODUCT ID: REJECT
    console.warn(`[WEBHOOK REJECTED] Unknown product_id: ${productId}`);
    return { success: false, statusCode: 400, error: `Bilinmeyen veya desteklenmeyen product_id: ${productId}` };
}

module.exports = router;
