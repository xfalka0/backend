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
                // Logic to update user's coins or VIP status based on the product
                await handleSuccessfulPayment(userId, event.product_id);
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

async function handleSuccessfulPayment(userId, productId) {
    // Example logic: Map products to coins or VIP levels
    // You can expand this based on your actual product IDs
    console.log(`[PAYMENT] Processing product ${productId} for user ${userId}`);

    if (productId.includes('coin_50')) {
        await db.query('UPDATE users SET coins = coins + 50 WHERE id = $1', [userId]);
    } else if (productId.includes('coin_150')) {
        await db.query('UPDATE users SET coins = coins + 150 WHERE id = $1', [userId]);
    } else if (productId.includes('vip_level_1')) {
        await db.query('UPDATE users SET vip_level = 1 WHERE id = $1', [userId]);
    }
    // Add more mappings as needed
}

module.exports = router;
