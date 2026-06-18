const { Pool } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

const pool = new Pool({
  connectionString: connectionString,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('--- Migrating Database ---');
    await client.query(`
      ALTER TABLE party_room_members 
      ADD COLUMN IF NOT EXISTS room_gift_points INTEGER DEFAULT 0;
    `);
    console.log('Migration successful: room_gift_points column added to party_room_members');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
