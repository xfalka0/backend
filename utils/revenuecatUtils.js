const axios = require('axios');
const { getVipLevel } = require('./vipUtils');
const { withTransaction } = require('./dbUtils');
const { isStarterProductId, claimStarterPackLock } = require('./starterPackUtils');

const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1';

let paymentSchemaPromise = null;

/**
 * Ensures payments.external_tx_id exists so client SDK IDs and store order IDs can be paired safely.
 */
async function ensurePaymentSchema(queryable) {
    if (!paymentSchemaPromise) {
        paymentSchemaPromise = (async () => {
            await queryable.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS external_tx_id VARCHAR(255)`);
            await queryable.query(`CREATE INDEX IF NOT EXISTS idx_payments_external_tx_id ON payments(external_tx_id)`);
        })().catch((err) => {
            paymentSchemaPromise = null;
            throw err;
        });
    }
    return paymentSchemaPromise;
}

/**
 * Returns true if the transaction ID is missing or generated locally by the client as a fallback.
 */
function isSyntheticTransactionId(txId) {
    if (!txId || typeof txId !== 'string') return true;
    const trimmed = txId.trim();
    if (!trimmed) return true;
    return /^(test_|manual_|rc_|claim_|anon_)/i.test(trimmed);
}

/**
 * Generates normalized candidate product keys for Google Play / RevenueCat matching.
 */
function normalizeProductKeys(productId) {
    if (!productId) return [];
    const raw = String(productId).trim();
    const base = raw.split(':')[0].trim();
    const candidates = [
        raw,
        base,
        base.endsWith('_v1') ? base.slice(0, -3) : `${base}_v1`,
    ];
    return [...new Set(candidates.filter(Boolean))];
}

/**
 * Queries RevenueCat REST API (when REVENUECAT_SECRET_KEY is configured) to verify a non-subscription purchase
 * and resolve both store_transaction_id (Google Play GPA.*) and RevenueCat's internal transaction id.
 */
async function verifyRevenueCatPurchase(userId, productId, clientTransactionId) {
    const apiKey = (process.env.REVENUECAT_SECRET_KEY || '').trim();
    if (!apiKey) {
        return { verified: null, fallback: true, reason: 'missing_secret_key' };
    }

    const keys = normalizeProductKeys(productId).map((k) => k.toLowerCase());
    const cleanClientTx = typeof clientTransactionId === 'string' ? clientTransactionId.trim() : null;
    const hasRealClientTx = cleanClientTx && !isSyntheticTransactionId(cleanClientTx);

    try {
        const res = await axios.get(
            `${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(String(userId))}`,
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    Accept: 'application/json',
                },
                timeout: 4500,
            }
        );

        const nonSubs = res.data?.subscriber?.non_subscriptions || {};
        const matchingEntries = [];

        for (const [rcProductKey, list] of Object.entries(nonSubs)) {
            if (!Array.isArray(list)) continue;
            const rcLower = rcProductKey.toLowerCase();
            const rcBase = rcLower.split(':')[0];
            const keyMatches =
                keys.length === 0 ||
                keys.includes(rcLower) ||
                keys.includes(rcBase) ||
                keys.includes(rcBase.replace(/_v1$/, '')) ||
                keys.includes(`${rcBase}_v1`);

            if (!keyMatches) continue;
            for (const entry of list) {
                matchingEntries.push({
                    productKey: rcProductKey,
                    id: entry?.id ? String(entry.id) : null,
                    store_transaction_id: entry?.store_transaction_id ? String(entry.store_transaction_id) : null,
                    purchase_date: entry?.purchase_date || null,
                });
            }
        }

        // Sort newest purchase first
        matchingEntries.sort((a, b) => {
            const ta = a.purchase_date ? Date.parse(a.purchase_date) : 0;
            const tb = b.purchase_date ? Date.parse(b.purchase_date) : 0;
            return tb - ta;
        });

        if (hasRealClientTx) {
            const exact = matchingEntries.find(
                (e) => e.store_transaction_id === cleanClientTx || e.id === cleanClientTx
            );
            if (exact) {
                const canonicalTransactionId = exact.store_transaction_id || exact.id;
                const alternateIds = [...new Set([exact.store_transaction_id, exact.id, cleanClientTx].filter(Boolean))];
                return {
                    verified: true,
                    matchedExact: true,
                    canonicalTransactionId,
                    alternateIds,
                    entries: [exact],
                };
            }
        }

        // Otherwise return recent purchases (within 15 minutes) so the DB layer can find any uncredited transaction
        const cutoff = Date.now() - 15 * 60 * 1000;
        const recentEntries = matchingEntries.filter((e) => {
            const ts = e.purchase_date ? Date.parse(e.purchase_date) : 0;
            return ts >= cutoff;
        });

        if (recentEntries.length > 0) {
            return {
                verified: true,
                matchedExact: false,
                entries: recentEntries,
                allEntries: matchingEntries,
            };
        }

        return {
            verified: false,
            reason: 'not_found_in_revenuecat',
            entries: [],
            allEntries: matchingEntries,
        };
    } catch (err) {
        const status = err.response?.status;
        if (status === 404) {
            return { verified: null, fallback: true, reason: 'subscriber_not_found' };
        }
        return { verified: null, fallback: true, reason: err.message };
    }
}

/**
 * Atomically records a payment and credits coins/VIP XP inside an active transaction client.
 * Guarantees 1x crediting even under concurrent client + webhook calls or differing SDK/store tx IDs.
 */
async function creditCoinPurchaseAtomic(client, {
    userId,
    coinsToAdd,
    price = 0,
    packageId = null,
    packageName = 'Coin Pack',
    primaryTxId,
    alternateTxIds = [],
    externalTxId = null,
    paymentMethod = 'google_play',
    txDescription = null,
    allowPairSourceMethods = [],
    pairFromClientToCanonical = false,
    pairWindowSeconds = 180,
    beforeCreditHook = null,
}) {
    await ensurePaymentSchema(client);

    const userRes = await client.query(
        'SELECT id, balance, vip_xp, vip_level, total_spent FROM users WHERE id::text = $1::text FOR UPDATE',
        [String(userId)]
    );
    if (userRes.rows.length === 0) {
        return { userNotFound: true };
    }

    const user = userRes.rows[0];
    const resolvedUserId = user.id;
    const currentBalance = parseInt(user.balance, 10) || 0;
    const currentVipXp = parseInt(user.vip_xp, 10) || 0;
    const currentVipLevel = parseInt(user.vip_level, 10) || 0;
    const currentTotalSpent = parseFloat(user.total_spent) || 0;

    const txCandidates = [
        ...new Set(
            [primaryTxId, ...(alternateTxIds || []), externalTxId]
                .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
                .map((v) => String(v).trim())
        ),
    ];

    // 1. Exact deduplication against primary transaction_id and paired external_tx_id
    if (txCandidates.length > 0) {
        const existingRes = await client.query(
            `SELECT id, transaction_id, payment_method
             FROM payments
             WHERE transaction_id = ANY($1::text[])
                OR external_tx_id = ANY($1::text[])
             LIMIT 1`,
            [txCandidates]
        );
        if (existingRes.rows.length > 0) {
            return {
                alreadyProcessed: true,
                resolvedUserId,
                balance: currentBalance,
                vipLevel: currentVipLevel,
                vipXp: currentVipXp,
                totalSpent: currentTotalSpent,
                paymentMethod: existingRes.rows[0].payment_method,
            };
        }
    }

    // 2. 1-to-1 pairing between client sync and webhook when SDK tx ID differs from Google Play GPA.* order ID
    if (Array.isArray(allowPairSourceMethods) && allowPairSourceMethods.length > 0 && coinsToAdd > 0) {
        const pairRes = await client.query(
            `SELECT id, transaction_id, payment_method
             FROM payments
             WHERE user_id::text = $1::text
               AND coin_amount = $2::integer
               AND status = 'completed'
               AND payment_method = ANY($3::text[])
               AND external_tx_id IS NULL
               AND created_at > NOW() - ($4::integer * INTERVAL '1 second')
             ORDER BY id DESC
             LIMIT 1
             FOR UPDATE`,
            [String(resolvedUserId), coinsToAdd, allowPairSourceMethods, pairWindowSeconds]
        );

        if (pairRes.rows.length > 0) {
            const paired = pairRes.rows[0];
            if (pairFromClientToCanonical && primaryTxId) {
                await client.query(
                    `UPDATE payments
                     SET external_tx_id = transaction_id,
                         transaction_id = $1::varchar,
                         payment_method = LEFT(COALESCE(payment_method, 'google_play') || '+revenuecat', 50)
                     WHERE id = $2`,
                    [String(primaryTxId), paired.id]
                );
            } else {
                const extRef = externalTxId || primaryTxId || 'paired';
                await client.query(
                    `UPDATE payments
                     SET external_tx_id = $1::varchar,
                         payment_method = LEFT(COALESCE(payment_method, 'revenuecat') || '+client', 50)
                     WHERE id = $2`,
                    [String(extRef), paired.id]
                );
            }
            return {
                alreadyProcessed: true,
                paired: true,
                resolvedUserId,
                balance: currentBalance,
                vipLevel: currentVipLevel,
                vipXp: currentVipXp,
                totalSpent: currentTotalSpent,
            };
        }
    }

    // 3. Optional pre-credit guard (e.g. starter_pack_purchases lock)
    if (typeof beforeCreditHook === 'function') {
        const shouldProceed = await beforeCreditHook(client, resolvedUserId);
        if (!shouldProceed) {
            if (primaryTxId) {
                await insertPaymentIfAbsent(client, {
                    userId: resolvedUserId,
                    packageId,
                    transactionId: String(primaryTxId),
                    externalTxId: externalTxId ? String(externalTxId) : null,
                    amount: parseFloat(price) || coinsToAdd,
                    coinAmount: coinsToAdd,
                    paymentMethod,
                    packageNameSnapshot: packageName,
                    status: 'completed',
                });
            }
            return {
                alreadyProcessed: true,
                blockedByHook: true,
                resolvedUserId,
                balance: currentBalance,
                vipLevel: currentVipLevel,
                vipXp: currentVipXp,
                totalSpent: currentTotalSpent,
            };
        }
    }

    // 4. Claim transaction row FIRST before updating balance
    const finalTxId = primaryTxId ? String(primaryTxId) : `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const cleanExternalTxId = externalTxId && String(externalTxId) !== finalTxId ? String(externalTxId) : null;
    const numericPrice = parseFloat(price) || 0;

    const insertedPaymentId = await insertPaymentIfAbsent(client, {
        userId: resolvedUserId,
        packageId,
        transactionId: finalTxId,
        externalTxId: cleanExternalTxId,
        amount: numericPrice || coinsToAdd,
        coinAmount: coinsToAdd,
        paymentMethod,
        packageNameSnapshot: packageName,
        status: 'completed',
    });

    if (!insertedPaymentId) {
        return {
            alreadyProcessed: true,
            resolvedUserId,
            balance: currentBalance,
            vipLevel: currentVipLevel,
            vipXp: currentVipXp,
            totalSpent: currentTotalSpent,
        };
    }

    // 5. Credit coins, VIP XP, VIP level, and total_spent atomically
    const newBalance = currentBalance + coinsToAdd;
    const newVipXp = currentVipXp + coinsToAdd;
    const newVipLevel = Math.max(currentVipLevel, getVipLevel(newVipXp));
    const isVip = newVipLevel > 0;
    const newTotalSpent = currentTotalSpent + numericPrice;

    await client.query(
        `UPDATE users
         SET balance = $1,
             vip_xp = $2,
             vip_level = $3,
             is_vip = $4,
             total_spent = $5
         WHERE id = $6`,
        [newBalance, newVipXp, newVipLevel, isVip, newTotalSpent, resolvedUserId]
    );

    await client.query(
        'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
        [resolvedUserId, coinsToAdd, 'purchase', txDescription || `${packageName} satın alındı`]
    );

    return {
        alreadyProcessed: false,
        resolvedUserId,
        balance: newBalance,
        oldBalance: currentBalance,
        coinsAdded: coinsToAdd,
        vipLevel: newVipLevel,
        oldVipLevel: currentVipLevel,
        vipXp: newVipXp,
        totalSpent: newTotalSpent,
        transactionId: finalTxId,
    };
}

/**
 * Inserts a payment row only if transaction_id is not already present, protected by a transaction-scoped advisory lock.
 * Works safely even if payments.transaction_id lacks a PostgreSQL UNIQUE constraint.
 */
async function insertPaymentIfAbsent(client, {
    userId,
    packageId = null,
    transactionId,
    externalTxId = null,
    amount = 0,
    coinAmount = null,
    paymentMethod = 'revenuecat',
    packageNameSnapshot = null,
    status = 'completed',
}) {
    await ensurePaymentSchema(client);
    const txKey = String(transactionId);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [txKey]);

    const existing = await client.query(
        `SELECT id FROM payments
         WHERE transaction_id = $1::varchar OR external_tx_id = $1::varchar
         LIMIT 1`,
        [txKey]
    );
    if (existing.rows.length > 0) {
        return null;
    }

    const inserted = await client.query(
        `INSERT INTO payments (user_id, package_id, transaction_id, external_tx_id, amount, coin_amount, payment_method, package_name_snapshot, status)
         VALUES ($1, $2, $3::varchar, $4::varchar, $5::numeric, $6::integer, $7::varchar, $8::varchar, $9::varchar)
         RETURNING id`,
        [
            userId,
            packageId,
            txKey,
            externalTxId ? String(externalTxId) : null,
            parseFloat(amount) || 0,
            coinAmount !== null && coinAmount !== undefined ? parseInt(coinAmount, 10) : null,
            paymentMethod,
            packageNameSnapshot,
            status,
        ]
    );
    return inserted.rows[0]?.id || null;
}

/**
 * Atomically claims any unassigned anonymous webhook purchase from the last 15 minutes for the authenticated user.
 */
async function autoClaimPendingWebhookPurchase(db, userId, io = null) {
    const claimOutcome = await withTransaction(db, async (client) => {
        const pending = await client.query(
            `SELECT * FROM processed_webhook_events
             WHERE claimed = FALSE
               AND coins > 0
               AND created_at > NOW() - INTERVAL '15 minutes'
             ORDER BY id DESC LIMIT 1 FOR UPDATE SKIP LOCKED`
        );

        if (pending.rows.length === 0) return null;

        const claimItem = pending.rows[0];
        const coinsToAdd = parseInt(claimItem.coins, 10) || 0;
        const claimPrice = parseFloat(claimItem.price) || 0;
        const txId = claimItem.transaction_id || `claim_${claimItem.id}`;

        if (coinsToAdd <= 0) return null;

        const isStarterClaim = isStarterProductId(claimItem.product_id);
        const result = await creditCoinPurchaseAtomic(client, {
            userId,
            coinsToAdd,
            price: claimPrice,
            packageId: null,
            packageName: claimItem.product_id || 'Coin Pack',
            primaryTxId: txId,
            paymentMethod: 'revenuecat_autoclaim',
            txDescription: `Otomatik Eşleşen Coin (${claimItem.product_id})`,
            allowPairSourceMethods: ['google_play', 'in_app', 'starter_pack', 'revenuecat_verified'],
            pairFromClientToCanonical: true,
            beforeCreditHook: isStarterClaim
                ? (txClient, resolvedId) => claimStarterPackLock(txClient, String(resolvedId), coinsToAdd)
                : null,
        });

        await client.query(
            `UPDATE processed_webhook_events
             SET claimed = TRUE, app_user_id = $1
             WHERE id = $2`,
            [String(userId), claimItem.id]
        );

        return { claimItem, coinsToAdd, claimPrice, txId, result };
    });

    if (claimOutcome && !claimOutcome.result.alreadyProcessed && !claimOutcome.result.userNotFound) {
        console.log(`[AUTO-CLAIM SUCCESS] Credited ${claimOutcome.coinsToAdd} coins to user ${userId} from tx ${claimOutcome.txId}`);
        if (io) {
            try {
                io.emit('new_payment', {
                    user_id: userId,
                    amount: claimOutcome.claimPrice || claimOutcome.coinsToAdd,
                    transaction_id: claimOutcome.txId,
                    status: 'completed',
                    created_at: new Date().toISOString()
                });
                io.emit('admin_payment_update', { type: 'auto-claim', user_id: userId });
            } catch (_) {}
        }
    } else if (claimOutcome && claimOutcome.result.alreadyProcessed) {
        console.log(`[AUTO-CLAIM SKIP] Purchase already credited for user ${userId} (tx: ${claimOutcome.txId})`);
    }

    return claimOutcome;
}

module.exports = {
    isSyntheticTransactionId,
    normalizeProductKeys,
    ensurePaymentSchema,
    insertPaymentIfAbsent,
    verifyRevenueCatPurchase,
    creditCoinPurchaseAtomic,
    autoClaimPendingWebhookPurchase,
};
