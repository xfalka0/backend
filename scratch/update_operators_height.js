const { Pool } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function updateHeights() {
  const client = await pool.connect();
  try {
    console.log('[DB] Fetching all female operators...');
    const res = await client.query("SELECT id, display_name, boy FROM users WHERE role = 'operator' AND gender = 'kadin'");
    console.log(`[DB] Found ${res.rows.length} female operators.`);

    for (const row of res.rows) {
      // Generate a random height between 155 and 170
      const randomBoy = Math.floor(Math.random() * (170 - 155 + 1)) + 155;
      await client.query("UPDATE users SET boy = $1 WHERE id = $2", [String(randomBoy), row.id]);
      console.log(`[DB] Updated operator ${row.display_name} (ID: ${row.id}) height to ${randomBoy} cm.`);
    }

    console.log('[DB] Finished updating female operators heights!');
  } catch (err) {
    console.error('[DB] Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

updateHeights();
