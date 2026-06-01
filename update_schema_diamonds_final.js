const { Pool } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

const pool = new Pool({
  connectionString: connectionString,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('--- [1] Ensuring "operators" Table Exists ---');
    await client.query(`
      CREATE TABLE IF NOT EXISTS operators (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        pending_balance NUMERIC DEFAULT 0,
        lifetime_earnings NUMERIC DEFAULT 0,
        last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_payout_at TIMESTAMP,
        commission_rate NUMERIC DEFAULT 0.25,
        is_online BOOLEAN DEFAULT FALSE,
        category VARCHAR(100),
        rating NUMERIC DEFAULT 5.0,
        bio TEXT,
        photos TEXT[]
      );
    `);

    console.log('--- [2] Ensuring "payouts" Table Exists (using INTEGER for operator_id) ---');
    await client.query(`
      CREATE TABLE IF NOT EXISTS payouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        operator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INT NOT NULL, 
        status VARCHAR(50) DEFAULT 'pending', 
        currency VARCHAR(10) DEFAULT 'TL', 
        payment_method TEXT DEFAULT 'IBAN', 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP
      );
    `);

    console.log('--- [3] Adding IBAN & Cashout Columns to "payouts" ---');
    await client.query(`
      ALTER TABLE payouts 
      ADD COLUMN IF NOT EXISTS iban VARCHAR(34) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS account_holder VARCHAR(150) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS cash_amount DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10, 2) DEFAULT 46.00,
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    console.log('--- [4] Ensuring "commission_logs" Table Exists (without strict foreign constraints on chat_id) ---');
    await client.query(`
      CREATE TABLE IF NOT EXISTS commission_logs (
        id SERIAL PRIMARY KEY,
        operator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chat_id INTEGER,
        amount NUMERIC NOT NULL,
        type VARCHAR(50) NOT NULL,
        agency_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    console.log('✅ Database schema updated and tables created successfully! Earnings & payouts system ready.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error during database migration:', err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
