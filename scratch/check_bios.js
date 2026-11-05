const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true'
});
async function check() {
  const r = await pool.query("SELECT user_id, bio FROM operators WHERE user_id IN (51, 53, 55, 42)");
  console.log(r.rows);
  pool.end();
}
check();
