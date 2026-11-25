const STARTER_PACK = {
    coins: 300,              // Kullanıcıya verilecek coin
    price: 199.99,           // Gerçek fiyat (gösterim için)
    discounted_price: 99.99, // İndirimli fiyat
    discount_percent: 50,    // %50 indirim
    label: 'Hoşgeldin Paketi',
    description: 'Sadece sana özel, 1 kez kullanılabilir başlangıç fırsatı!'
};

const STARTER_EXACT_IDS = new Set([
    'starter300',
    'starter_pack',
    '300_coins_starter',
    'starter:starter300',
]);

let ensureTablePromise = null;

/**
 * Checks whether a store/RevenueCat product identifier refers to the one-time starter pack.
 */
function isStarterProductId(productId) {
    if (!productId) return false;
    const raw = String(productId).trim().toLowerCase();
    const base = raw.split(':')[0].trim();
    if (STARTER_EXACT_IDS.has(raw) || STARTER_EXACT_IDS.has(base)) {
        return true;
    }
    return (
        (raw.includes('starter') && raw.includes('300')) ||
        (raw.includes('baslangic') && raw.includes('300'))
    );
}

/**
 * Ensures the starter_pack_purchases table exists.
 */
async function ensureStarterPackTable(queryable) {
    if (!ensureTablePromise) {
        ensureTablePromise = queryable.query(`
            CREATE TABLE IF NOT EXISTS starter_pack_purchases (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                purchased_at TIMESTAMP DEFAULT NOW(),
                coins_received INTEGER NOT NULL,
                UNIQUE(user_id)
            )
        `).catch((err) => {
            ensureTablePromise = null;
            throw err;
        });
    }
    return ensureTablePromise;
}

/**
 * Atomically claims the one-time starter pack for a user.
 * Returns true if this caller won the claim, false if already claimed.
 */
async function claimStarterPackLock(queryable, userId, coins = STARTER_PACK.coins) {
    await ensureStarterPackTable(queryable);
    const res = await queryable.query(
        `INSERT INTO starter_pack_purchases (user_id, coins_received)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING id`,
        [String(userId), coins]
    );
    return res.rows.length > 0;
}

/**
 * Runs a callback inside a dedicated PostgreSQL client transaction when pool.connect is available.
 */
async function withTransaction(db, fn) {
    if (db.pool && typeof db.pool.connect === 'function') {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
        } catch (err) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            throw err;
        } finally {
            client.release();
        }
    }

    await db.query('BEGIN');
    try {
        const result = await fn(db);
        await db.query('COMMIT');
        return result;
    } catch (err) {
        try { await db.query('ROLLBACK'); } catch (_) {}
        throw err;
    }
}

module.exports = {
    STARTER_PACK,
    isStarterProductId,
    ensureStarterPackTable,
    claimStarterPackLock,
    withTransaction,
};
