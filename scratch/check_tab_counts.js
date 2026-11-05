const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true'
});

async function check() {
  const targetGender = 'kadin';
  const userId = 853;
  const whereClause = `WHERE (LOWER(u.gender) = LOWER($1) OR u.gender = 'coin_bayisi' OR (LOWER($1) = 'kadin' AND LOWER(u.gender) IN ('kadin', 'kadın', 'female')) OR (LOWER($1) = 'erkek' AND LOWER(u.gender) IN ('erkek', 'male'))) AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff') AND (u.gender_confirmed_at IS NOT NULL OR u.role = 'operator' OR u.gender = 'coin_bayisi') AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $2 UNION SELECT blocker_id FROM blocks WHERE blocked_id = $2)`;

  // Check each tab count
  const qAll = await pool.query(`SELECT count(*) FROM users u LEFT JOIN operators o ON u.id = o.user_id ${whereClause} AND u.id != $2 AND u.account_status = 'active'`, [targetGender, userId]);
  
  const qOnline = await pool.query(`SELECT count(*) FROM users u LEFT JOIN operators o ON u.id = o.user_id ${whereClause} AND o.is_online = TRUE AND u.id != $2 AND u.account_status = 'active'`, [targetGender, userId]);
  
  console.log({ total: qAll.rows[0].count, online: qOnline.rows[0].count });
  pool.end();
}
check();
