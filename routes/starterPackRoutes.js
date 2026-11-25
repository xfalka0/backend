const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const {
    STARTER_PACK,
    ensureStarterPackTable,
    claimStarterPackLock,
    withTransaction,
} = require('../utils/starterPackUtils');

// Ensure starter_pack_purchases table exists
ensureStarterPackTable(db).catch(console.error);

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
            'SELECT balance, total_spent FROM users WHERE id::text = $1::text',
            [userId]
        );
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const { balance, total_spent } = userRes.rows[0];

        const totalSpent = parseFloat(total_spent || 0);
        const currentBalance = parseInt(balance || 0);

        if (totalSpent > 0) {
            return res.json({ eligible: false, reason: 'not_first_time' });
        }

        // Fallback check: older webhook or payment records before starter_pack_purchases backfill
        const [paymentRes, txRes] = await Promise.all([
            db.query(
                `SELECT 1 FROM payments
                 WHERE user_id::text = $1::text AND status IN ('completed', 'completed_vip')
                 LIMIT 1`,
                [userId]
            ),
            db.query(
                `SELECT 1 FROM transactions
                 WHERE user_id::text = $1::text AND type IN ('starter_pack', 'purchase')
                 LIMIT 1`,
                [userId]
            )
        ]);

        if (paymentRes.rows.length > 0 || txRes.rows.length > 0) {
            return res.json({ eligible: false, reason: 'already_purchased' });
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
// Syncs starter pack purchase after RevenueCat payment without double-crediting if webhook already processed it
router.post('/purchase', authenticateToken, async (req, res) => {
    const userId = req.user.id.toString();
    const { transactionId } = req.body;
    const cleanTxId = typeof transactionId === 'string' && transactionId.trim() ? transactionId.trim() : null;

    try {
        const outcome = await withTransaction(db, async (client) => {
            const userRes = await client.query(
                'SELECT id, balance FROM users WHERE id::text = $1::text FOR UPDATE',
                [userId]
            );
            if (userRes.rows.length === 0) {
                return { status: 404, body: { error: 'Kullanıcı bulunamadı.' } };
            }

            const currentBalance = parseInt(userRes.rows[0].balance || 0, 10);

            // If RevenueCat webhook already credited this transactionId, return success without adding coins again
            if (cleanTxId) {
                const existingTx = await client.query(
                    'SELECT id FROM payments WHERE transaction_id = $1',
                    [cleanTxId]
                );
                if (existingTx.rows.length > 0) {
                    await claimStarterPackLock(client, userId, STARTER_PACK.coins);
                    return {
                        status: 200,
                        alreadyProcessed: true,
                        body: {
                            success: true,
                            already_processed: true,
                            coins_added: STARTER_PACK.coins,
                            new_balance: currentBalance,
                            message: `${STARTER_PACK.coins} coin hesabınıza eklendi!`
                        }
                    };
                }
            }

            // Atomically claim the one-time starter pack lock
            const claimedNow = await claimStarterPackLock(client, userId, STARTER_PACK.coins);
            if (!claimedNow) {
                // If webhook beat this request by a few seconds with a different/fallback transactionId,
                // treat a just-recorded purchase during checkout as already processed rather than showing an error.
                if (cleanTxId) {
                    const recentRes = await client.query(
                        `SELECT purchased_at FROM starter_pack_purchases
                         WHERE user_id = $1 AND purchased_at > NOW() - INTERVAL '120 seconds'`,
                        [userId]
                    );
                    if (recentRes.rows.length > 0) {
                        return {
                            status: 200,
                            alreadyProcessed: true,
                            body: {
                                success: true,
                                already_processed: true,
                                coins_added: STARTER_PACK.coins,
                                new_balance: currentBalance,
                                message: `${STARTER_PACK.coins} coin hesabınıza eklendi!`
                            }
                        };
                    }
                }
                return { status: 400, body: { error: 'Bu paketi daha önce satın aldınız.' } };
            }

            // Add exactly STARTER_PACK.coins (300)
            const updateRes = await client.query(
                `UPDATE users SET balance = COALESCE(balance, 0) + $1,
                 total_spent = COALESCE(total_spent, 0) + $2
                 WHERE id::text = $3::text RETURNING balance`,
                [STARTER_PACK.coins, STARTER_PACK.discounted_price, userId]
            );
            const newBalance = updateRes.rows[0].balance;

            // Record payment so a subsequent RevenueCat webhook with the same transactionId skips crediting
            if (cleanTxId) {
                await client.query(
                    `INSERT INTO payments (user_id, package_id, transaction_id, amount, coin_amount, payment_method, package_name_snapshot, status)
                     VALUES ($1, NULL, $2::varchar, $3::numeric, $4::integer, 'starter_pack', $5::varchar, 'completed')
                     ON CONFLICT (transaction_id) DO NOTHING`,
                    [userId, cleanTxId, STARTER_PACK.discounted_price, STARTER_PACK.coins, `${STARTER_PACK.label} (Başlangıç Paketi)`]
                );
            }

            // Record transaction
            await client.query(
                'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
                [userId, STARTER_PACK.coins, 'starter_pack', `${STARTER_PACK.label} - Başlangıç Paketi`]
            );

            return {
                status: 200,
                alreadyProcessed: false,
                newBalance,
                body: {
                    success: true,
                    coins_added: STARTER_PACK.coins,
                    new_balance: newBalance,
                    message: `${STARTER_PACK.coins} coin hesabınıza eklendi!`
                }
            };
        });

        if (outcome.status !== 200) {
            return res.status(outcome.status).json(outcome.body);
        }

        if (!outcome.alreadyProcessed) {
            const io = req.app.get('io');
            if (io) {
                io.to(`user_${userId}`).emit('balance_update', {
                    userId,
                    balance: outcome.newBalance,
                    newBalance: outcome.newBalance,
                    hearts: outcome.newBalance
                });
            }
            console.log(`[STARTER PACK] User ${userId} purchased starter pack (+${STARTER_PACK.coins}). New balance: ${outcome.newBalance}`);
        } else {
            console.log(`[STARTER PACK] User ${userId} starter pack already credited by webhook. Returning balance: ${outcome.body.new_balance}`);
        }

        res.json(outcome.body);
    } catch (err) {
        console.error('[STARTER PACK] Purchase error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
