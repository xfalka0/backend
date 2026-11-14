const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { getVipLevel, VIP_THRESHOLDS } = require('../utils/vipUtils');

// Server-side product catalogs (fixed truth source)
const COIN_PRODUCT_MAPPING = {
    'coins_100': 100,
    'coins_100_v1': 100,
    'coins_200': 200,
    'coins_200_v1': 200,
    'coins_400': 400,
    'coins_400_v1': 400,
    'coins_700': 700,
    'coins_700_v1': 700,
    'coins_1200': 1200,
    'coins_1200_v1': 1200,
    'coins_2500': 2500,
    'coins_2500_v1': 2500,
    'coins_5000': 5000,
    'coins_5000_v1': 5000,
    'coins_10000_v1': 10000,
    'coins_20000_v1': 20000,
    'coins_40000_v1': 40000,
    'starter300': 300,
    'starter_pack': 300,
    '300_coins_starter': 300
};

const VIP_PRODUCT_MAPPING = {
    'premium_1_month': 1,
    'premium_3_months': 3,
    'premium_6_months': 6,
    'premium_12_months': 12,
    'premium_1_year': 12,
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
        // Self-healing: If table does not exist yet on database, create it automatically on the fly
        if (checkErr.message && (checkErr.message.includes('does not exist') || checkErr.code === '42P01')) {
            try {
                await db.query(`
                    CREATE TABLE IF NOT EXISTS processed_webhook_events (
                        id SERIAL PRIMARY KEY,
                        event_id VARCHAR(255) UNIQUE NOT NULL,
                        app_user_id VARCHAR(255),
                        event_type VARCHAR(100),
                        product_id VARCHAR(100),
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event_id ON processed_webhook_events(event_id);
                `);
                console.log('[WEBHOOK] Auto-created processed_webhook_events table on the fly');
            } catch (createErr) {
                console.error('[WEBHOOK ERROR] Auto-create table failed:', createErr.message);
                return res.status(500).json({ error: 'Database error during idempotency check' });
            }
        } else {
            console.error('[WEBHOOK ERROR] Idempotency check failed:', checkErr.message);
            return res.status(500).json({ error: 'Database error during idempotency check' });
        }
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
    const rawProductId = event.product_id || event.productId || '';
    const cleanProductId = rawProductId.toString().split(':')[0].trim();
    const transactionId = event.transaction_id || event.id || `rc_${Date.now()}`;

    // 1. Resolve Target User ID (support anonymous alias merging)
    let targetUserId = userId;
    if (!targetUserId || String(targetUserId).startsWith('$RCAnonymousID:')) {
        const candidateIds = [
            event.original_app_user_id,
            ...(Array.isArray(event.aliases) ? event.aliases : [])
        ].filter(id => id && !String(id).startsWith('$RCAnonymousID:'));

        for (const candidate of candidateIds) {
            const checkUser = await db.query('SELECT id FROM users WHERE id::text = $1::text', [candidate]);
            if (checkUser.rows.length > 0) {
                targetUserId = checkUser.rows[0].id;
                console.log(`[WEBHOOK] Resolved anonymous ID ${userId} to real user ID: ${targetUserId}`);
                break;
            }
        }
    }

    // 2. Identify Product Category (Coins vs VIP/Premium)
    let isCoinProduct = COIN_PRODUCT_MAPPING.hasOwnProperty(cleanProductId) || COIN_PRODUCT_MAPPING.hasOwnProperty(rawProductId);
    let coinAmount = COIN_PRODUCT_MAPPING[cleanProductId] || COIN_PRODUCT_MAPPING[rawProductId] || 0;
    let packageId = null;
    let price = 0;

    try {
        const dbPkg = await db.query(
            `SELECT * FROM coin_packages 
             WHERE revenuecat_id = $1 OR revenuecat_id = $2 OR revenuecat_id = $3`,
            [cleanProductId, cleanProductId + '_v1', cleanProductId.replace('_v1', '')]
        );
        if (dbPkg.rows.length > 0) {
            isCoinProduct = true;
            coinAmount = parseInt(dbPkg.rows[0].coins, 10);
            packageId = dbPkg.rows[0].id;
            price = parseFloat(dbPkg.rows[0].price);
        }
    } catch (e) {
        console.warn('[WEBHOOK] coin_packages DB check fallback:', e.message);
    }

    // Fallback: If user ID is anonymous, save as pending so immediate balance check can auto-claim
    if (!targetUserId || String(targetUserId).startsWith('$RCAnonymousID:')) {
        if (isCoinProduct && coinAmount > 0) {
            try {
                await db.query(
                    `INSERT INTO processed_webhook_events 
                     (event_id, app_user_id, event_type, product_id, coins, transaction_id, price, claimed, created_at) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW()) 
                     ON CONFLICT (event_id) DO UPDATE SET claimed = FALSE, coins = $5, transaction_id = $6, price = $7`,
                    [event.id || `anon_${Date.now()}`, userId || null, event.type || 'PURCHASE', cleanProductId, coinAmount, transactionId, price || 0]
                );
                console.log(`[WEBHOOK PENDING] Stored anonymous purchase of ${coinAmount} coins (tx: ${transactionId}) for auto-claim`);
                return { success: true, pendingClaim: true };
            } catch (pErr) {
                console.error('[WEBHOOK PENDING ERROR]', pErr.message);
            }
        }
        return { success: false, statusCode: 400, error: 'Missing or unresolvable app_user_id' };
    }

    // A) Process Coin Products
    if (isCoinProduct && coinAmount > 0) {
        try {
            await db.query('BEGIN');

            const existingTx = await db.query('SELECT id FROM payments WHERE transaction_id = $1', [transactionId]);
            if (existingTx.rows.length === 0) {
                const userRes = await db.query('SELECT id, balance, vip_xp, vip_level, total_spent FROM users WHERE id::text = $1::text FOR UPDATE', [targetUserId]);
                if (userRes.rows.length === 0) {
                    await db.query('ROLLBACK');
                    return { success: false, statusCode: 404, error: 'User not found' };
                }

                const resolvedUser = userRes.rows[0];
                const numericUserId = parseInt(resolvedUser.id, 10);
                const currentBalance = parseInt(resolvedUser.balance, 10) || 0;
                const currentVipXp = parseInt(resolvedUser.vip_xp, 10) || 0;
                const currentVipLevel = parseInt(resolvedUser.vip_level, 10) || 0;
                const currentTotalSpent = parseFloat(resolvedUser.total_spent) || 0;

                const newBalance = currentBalance + coinAmount;
                const newVipXp = currentVipXp + coinAmount;
                const calculatedLevel = getVipLevel(newVipXp);
                const newVipLevel = Math.max(currentVipLevel, calculatedLevel);
                const newTotalSpent = currentTotalSpent + (price || 0);

                await db.query(
                    'UPDATE users SET balance = $1, vip_xp = $2, vip_level = $3, total_spent = $4 WHERE id = $5',
                    [newBalance, newVipXp, newVipLevel, newTotalSpent, numericUserId]
                );

                await db.query(
                    'INSERT INTO payments (user_id, package_id, transaction_id, amount, status) VALUES ($1, $2, $3, $4, $5)',
                    [numericUserId, packageId, transactionId, price || coinAmount, 'completed']
                );
                await db.query(
                    'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
                    [numericUserId, coinAmount, 'purchase', `RevenueCat webhook: ${cleanProductId}`]
                );

                console.log(`[WEBHOOK SUCCESS] Added ${coinAmount} coins to user ${numericUserId} for tx ${transactionId}`);

                if (io) {
                    io.to(`user_${numericUserId}`).emit('balance_update', {
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
    const isVipProduct = VIP_PRODUCT_MAPPING.hasOwnProperty(cleanProductId) || VIP_PRODUCT_MAPPING.hasOwnProperty(rawProductId);
    if (isVipProduct) {
        const months = VIP_PRODUCT_MAPPING[cleanProductId] || VIP_PRODUCT_MAPPING[rawProductId] || 1;
        try {
            await db.query('BEGIN');
            const userRes = await db.query(
                'SELECT id, vip_expire_date, is_vip, vip_level FROM users WHERE id::text = $1::text FOR UPDATE',
                [targetUserId]
            );
            if (userRes.rows.length === 0) {
                await db.query('ROLLBACK');
                return { success: false, statusCode: 404, error: 'User not found' };
            }

            const user = userRes.rows[0];
            const numericUserId = parseInt(user.id, 10);
            let baseDate = new Date();
            let startDate = new Date();

            if (user.vip_expire_date && new Date(user.vip_expire_date) > baseDate) {
                baseDate = new Date(user.vip_expire_date);
            }

            baseDate.setMonth(baseDate.getMonth() + months);

            await db.query(
                `UPDATE users 
                 SET is_premium = true, 
                     premium_start_date = $1::timestamptz, 
                     premium_expire_date = $2::timestamptz, 
                     vip_start_date = $1::timestamptz, 
                     vip_expire_date = $2::timestamp 
                 WHERE id = $3`,
                [startDate, baseDate, numericUserId]
            );

            await db.query('INSERT INTO payments (user_id, transaction_id, amount, status) VALUES ($1, $2, $3, $4)',
                [numericUserId, transactionId, months, 'completed_vip']);

            await db.query('COMMIT');
            console.log(`[WEBHOOK VIP SUCCESS] Activated ${months} months VIP for user ${numericUserId} until ${baseDate.toISOString()}`);

            if (io) {
                io.to(`user_${numericUserId}`).emit('vip_level_up', {
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
    console.warn(`[WEBHOOK REJECTED] Unknown product_id: ${rawProductId}`);
    return { success: false, statusCode: 400, error: `Bilinmeyen veya desteklenmeyen product_id: ${rawProductId}` };
}

module.exports = router;
