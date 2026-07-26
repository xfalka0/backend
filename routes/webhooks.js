const express = require('express');
const router = express.Router();
const db = require('../db');

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

        switch (event.type) {
            case 'INITIAL_PURCHASE':
            case 'RENEWAL':
            case 'NON_RENEWING_PURCHASE':
                await handleSuccessfulPayment(userId, event);
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

async function handleSuccessfulPayment(userId, event) {
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

    // Try to extract amount dynamically if exact match fails (e.g. coins_5000_v1)
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
                await db.query('UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2', [coinAmount, userId]);
                await db.query('INSERT INTO payments (user_id, transaction_id, amount, status) VALUES ($1, $2, $3, $4)',
                    [userId, transactionId, coinAmount, 'completed']);
                await db.query('INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
                    [userId, coinAmount, 'webhook_purchase', `RevenueCat webhook: ${productId}`]);
                console.log(`[WEBHOOK SUCCESS] Added ${coinAmount} coins to user ${userId} for transaction ${transactionId}`);
            } else {
                console.log(`[WEBHOOK DUPLICATE] Transaction ${transactionId} already processed.`);
            }
            await db.query('COMMIT');
        } catch (err) {
            await db.query('ROLLBACK');
            console.error('[WEBHOOK PAYMENT ERROR]', err.message);
        }
    } else if (productId.includes('vip_level_1')) {
        await db.query('UPDATE users SET vip_level = 1 WHERE id = $1', [userId]);
    } else {
        console.warn(`[WEBHOOK] Unhandled product ID mapping: ${productId}`);
    }
}

module.exports = router;
