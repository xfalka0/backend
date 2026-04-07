
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'dating',
  password: String(process.env.DB_PASSWORD) || '123',
  port: process.env.DB_PORT || 5432,
});

async function updateSchema() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('--- Updating Operators Table ---');
    await client.query(`
      ALTER TABLE operators 
      ADD COLUMN IF NOT EXISTS pending_balance INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS lifetime_earnings INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_payout_at TIMESTAMP;
    `);

    console.log('--- Creating Payouts Table ---');
    await client.query(`
      CREATE TABLE IF NOT EXISTS payouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        operator_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount INT NOT NULL, -- Harcanan coin miktarı değil, kazanılan para/coin karşılığı
        status VARCHAR(50) DEFAULT 'pending', -- pending, processed, cancelled
        currency VARCHAR(10) DEFAULT 'TL', -- Ödeme birimi
        payment_method TEXT, -- IBAN, Papara, USDT vb.
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP
      );
    `);

    console.log('--- Creating Operator History (Stats) Table ---');
    // Her günü veya her her mesajı loglamak için daha detaylı bir yapı
    await client.query(`
      CREATE TABLE IF NOT EXISTS operator_stats (
        id SERIAL PRIMARY KEY,
        operator_id UUID REFERENCES users(id) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE,
        messages_sent INT DEFAULT 0,
        gifts_received INT DEFAULT 0,
        coins_earned INT DEFAULT 0, -- Operatörün kazandığı pay
        total_user_spend INT DEFAULT 0, -- Kullanıcının harcadığı toplam coin
        unique_users_engaged INT DEFAULT 0,
        UNIQUE(operator_id, date)
      );
    `);

    await client.query('COMMIT');
    console.log('Veritabanı başarıyla güncellendi! Operatör takip sistemi hazır.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Hata oluştu:', e);
  } finally {
    client.release();
    process.exit();
  }
}

updateSchema();
