const { Pool } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkOtps() {
  try {
    const res = await pool.query('SELECT * FROM otps ORDER BY expires_at DESC LIMIT 10');
    console.log('--- LATEST 10 OTPS IN DB ---');
    console.log(JSON.stringify(res.rows, null, 2));
    
    const timeRes = await pool.query('SELECT NOW() as db_time');
    console.log('--- DATABASE CURRENT TIME ---');
    console.log(timeRes.rows[0].db_time);
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await pool.end();
  }
}

checkOtps();
