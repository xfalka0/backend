const { Pool } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkUsers() {
  try {
    const res = await pool.query('SELECT id, email, username, created_at FROM users ORDER BY id DESC LIMIT 20');
    console.log('--- LATEST 20 USERS IN DB ---');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await pool.end();
  }
}

checkUsers();
