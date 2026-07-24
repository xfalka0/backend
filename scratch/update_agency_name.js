const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await pool.query('UPDATE agencies SET name = $1 WHERE id = $2', ['STAR AGENCY', '1234']);
  const res = await pool.query('SELECT u.id, u.display_name, a.name as agency_name FROM users u JOIN agencies a ON u.agency_id::text = a.id::text');
  console.log('Users with updated agency:', res.rows);
  await pool.end();
}

main();
