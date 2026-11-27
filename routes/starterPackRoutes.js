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
const {
    isSyntheticTransactionId,
    ensurePaymentSchema,
    verifyRevenueCatPurchase,
    creditCoinPurchaseAtomic,
} = require('../utils/revenuecatUtils');
const { recordLockedPhotoPurchaseConversion } = require('../services/lockedPhotoPromoService');

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
    const syntheticTx = isSyntheticTransactionId(cleanTxId);

    try {
        await ensurePaymentSchema(db);
        const rcResult = await verifyRevenueCatPurchase(userId, 'starter300', cleanTxId);
        let chosenTx = null;

        if (rcResult.verified === true && Array.isArray(rcResult.entries) && rcResult.entries.length > 0) {
            chosenTx = rcResult.entries[0];
        } else if (rcResult.verified === false) {
            // Check if webhook already recorded starter_pack_purchases within 120s
            for (let attempt = 0; attempt < 2; attempt++) {
                const spRes = await db.query(
                    `SELECT s.purchased_at, u.balance FROM starter_pack_purchases s
                     JOIN users u ON u.id::text = s.user_id
                     WHERE s.user_id = $1 AND s.purchased_at > NOW() - INTERVAL '120 seconds'`,
                    [userId]
                );
                if (spRes.rows.length > 0) {
                    const curBal = parseInt(spRes.rows[0].balance || 0, 10);
                    return res.json({
                        success: true,
                        already_processed: true,
                        coins_added: STARTER_PACK.coins,
                        new_balance: curBal,
                        message: `${STARTER_PACK.coins} coin hesabınıza eklendi!`
                    });
                }
                if (attempt === 0) await new Promise((r) => setTimeout(r, 700));
            }
            const alreadyEver = await db.query('SELECT 1 FROM starter_pack_purchases WHERE user_id = $1', [userId]);
            if (alreadyEver.rows.length > 0) {
                return res.status(400).json({ error: 'Bu paketi daha önce satın aldınız.' });
            }
            return res.status(402).json({ error: 'Başlangıç paketi ödemesi RevenueCat tarafından doğrulanamadı.' });
        }

        const webhooksActive = Boolean((process.env.REVENUECAT_WEBHOOK_SECRET || '').trim());
        if (rcResult.fallback && syntheticTx && webhooksActive) {
            for (let attempt = 0; attempt < 2; attempt++) {
                const spRes = await db.query(
                    `SELECT s.purchased_at, u.balance FROM starter_pack_purchases s
                     JOIN users u ON u.id::text = s.user_id
                     WHERE s.user_id = $1 AND s.purchased_at > NOW() - INTERVAL '120 seconds'`,
                    [userId]
                );
                if (spRes.rows.length > 0) {
                    const curBal = parseInt(spRes.rows[0].balance || 0, 10);
                    return res.json({
                        success: true,
                        already_processed: true,
                        coins_added: STARTER_PACK.coins,
                        new_balance: curBal,
                        message: `${STARTER_PACK.coins} coin hesabınıza eklendi!`
                    });
                }
                if (attempt === 0) await new Promise((r) => setTimeout(r, 700));
            }
        }

        const canonicalTxId = chosenTx?.store_transaction_id || chosenTx?.id || cleanTxId || `starter_${userId}_${Date.now()}`;
        const externalTxId = chosenTx?.id && chosenTx.id !== canonicalTxId
            ? chosenTx.id
            : (!syntheticTx && cleanTxId !== canonicalTxId ? cleanTxId : null);
        const alternateTxIds = [...new Set([
            chosenTx?.store_transaction_id,
            chosenTx?.id,
            syntheticTx ? null : cleanTxId,
        ].filter(Boolean))];

        const outcome = await withTransaction(db, async (client) => {
            const atomicRes = await creditCoinPurchaseAtomic(client, {
                userId,
                coinsToAdd: STARTER_PACK.coins,
                price: STARTER_PACK.discounted_price,
                packageId: null,
                packageName: `${STARTER_PACK.label} (Başlangıç Paketi)`,
                primaryTxId: canonicalTxId,
                alternateTxIds,
                externalTxId,
                paymentMethod: 'starter_pack',
                txDescription: `${STARTER_PACK.label} - Başlangıç Paketi`,
                allowPairSourceMethods: ['revenuecat', 'revenuecat_autoclaim'],
                pairFromClientToCanonical: false,
                beforeCreditHook: (txClient, resolvedId) => claimStarterPackLock(txClient, String(resolvedId), STARTER_PACK.coins),
            });

            if (atomicRes.userNotFound) {
                return { status: 404, body: { error: 'Kullanıcı bulunamadı.' } };
            }

            if (atomicRes.alreadyProcessed) {
                await claimStarterPackLock(client, userId, STARTER_PACK.coins);
                if (atomicRes.blockedByHook) {
                    const recentRes = await client.query(
                        `SELECT purchased_at FROM starter_pack_purchases
                         WHERE user_id = $1 AND purchased_at > NOW() - INTERVAL '120 seconds'`,
                        [userId]
                    );
                    if (recentRes.rows.length === 0) {
                        return { status: 400, body: { error: 'Bu paketi daha önce satın aldınız.' } };
                    }
                }
                return {
                    status: 200,
                    alreadyProcessed: true,
                    body: {
                        success: true,
                        already_processed: true,
                        coins_added: STARTER_PACK.coins,
                        new_balance: atomicRes.balance,
                        message: `${STARTER_PACK.coins} coin hesabınıza eklendi!`
                    }
                };
            }

            return {
                status: 200,
                alreadyProcessed: false,
                newBalance: atomicRes.balance,
                body: {
                    success: true,
                    coins_added: STARTER_PACK.coins,
                    new_balance: atomicRes.balance,
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
                io.emit('new_payment', {
                    user_id: userId,
                    amount: STARTER_PACK.discounted_price,
                    transaction_id: canonicalTxId,
                    status: 'completed',
                    created_at: new Date().toISOString()
                });
                io.emit('admin_payment_update', { type: 'coins', user_id: userId });
            }
            recordLockedPhotoPurchaseConversion({ userId, paymentId: canonicalTxId, amount: STARTER_PACK.discounted_price }).catch(() => {});
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
