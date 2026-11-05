const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true'
});
async function check() {
  const r = await pool.query(`
    SELECT u.id, u.username, u.display_name, u.avatar_url, u.gender, u.age, u.city, o.photos, o.bio, o.is_online
    FROM users u
    LEFT JOIN operators o ON u.id = o.user_id
    WHERE u.id IN (42, 41, 40, 39, 37, 36, 66, 62, 58, 55, 53, 51, 38, 74)
  `);
  console.log(JSON.stringify(r.rows, null, 2));
  pool.end();
}
check();
