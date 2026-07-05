const { Pool } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function addCityColumn() {
  const client = await pool.connect();
  try {
    console.log('[DB] Adding "city" column to "users" table...');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100)');
    console.log('[DB] Success! "city" column added.');
  } catch (err) {
    console.error('[DB] Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

addCityColumn();
