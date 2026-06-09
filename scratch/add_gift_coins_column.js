const { Pool } = require('c:/Users/Falka/Desktop/dating/backend/node_modules/pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('Running ALTER TABLE migration on operator_stats...');
    await pool.query('ALTER TABLE operator_stats ADD COLUMN IF NOT EXISTS gift_coins_received NUMERIC DEFAULT 0');
    console.log('Migration SUCCESSFUL! Column gift_coins_received added to operator_stats.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
