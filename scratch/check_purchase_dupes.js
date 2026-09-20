require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    // Son 20 purchase transaction
    const txRes = await pool.query(`
        SELECT t.user_id, t.amount, t.type, t.description, t.created_at
        FROM transactions t
        WHERE t.type IN ('purchase', 'webhook_purchase', 'starter_pack')
        ORDER BY t.created_at DESC
        LIMIT 20
    `);
    console.log('\n=== Son 20 Purchase Transaction ===');
    console.table(txRes.rows);

    // Son 20 payment
    const payRes = await pool.query(`
        SELECT p.user_id, p.transaction_id, p.amount, p.status, p.created_at
        FROM payments p
        ORDER BY p.created_at DESC
        LIMIT 20
    `);
    console.log('\n=== Son 20 Payment Kaydı ===');
    console.table(payRes.rows);

    // Hangi coin paketleri var ve kaç coin var
    const pkgRes = await pool.query(`SELECT id, name, coins, price, revenuecat_id, is_active FROM coin_packages ORDER BY coins`);
    console.log('\n=== Coin Paketleri ===');
    console.table(pkgRes.rows);
}

check().catch(console.error).finally(() => pool.end());
