const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true'
});

async function check() {
  const targetGender = 'kadin';
  const userId = 853; // dummy male id
  const limitNum = 30;
  const offset = 0;

  const whereClause = `WHERE (LOWER(u.gender) = LOWER($1) OR u.gender = 'coin_bayisi' OR (LOWER($1) = 'kadin' AND LOWER(u.gender) IN ('kadin', 'kadın', 'female')) OR (LOWER($1) = 'erkek' AND LOWER(u.gender) IN ('erkek', 'male'))) AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff') AND (u.gender_confirmed_at IS NOT NULL OR u.role = 'operator' OR u.gender = 'coin_bayisi') AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $2 UNION SELECT blocker_id FROM blocks WHERE blocked_id = $2)`;

  const orderByClause = 'ORDER BY o.is_online DESC NULLS LAST, (u.created_at >= NOW() - INTERVAL \'3 days\') DESC, COALESCE(active_boosts.val, FALSE) DESC, u.vip_level DESC, (coalesce(cardinality(o.photos), 0) > 0) DESC, u.created_at DESC, u.id DESC';

  const query = `
      SELECT 
          u.id, 
          COALESCE(u.display_name, u.username) as name, 
          u.avatar_url, 
          u.gender, 
          u.age, 
          u.vip_level, 
          u.job,
          u.city,
          o.is_online, 
          o.photos
      FROM users u
      LEFT JOIN operators o ON u.id = o.user_id
      LEFT JOIN LATERAL (
          SELECT TRUE as val FROM boosts b WHERE b.user_id = u.id AND b.end_time > NOW() LIMIT 1
      ) active_boosts ON TRUE
      ${whereClause}
        AND u.id != $2
        AND u.account_status = 'active'
      ${orderByClause}
      LIMIT $3 OFFSET $4
  `;

  const res = await pool.query(query, [targetGender, userId, limitNum, offset]);
  console.log('Result count:', res.rows.length);
  res.rows.forEach((r, idx) => {
    console.log(`${idx + 1}. ID: ${r.id}, Name: ${r.name}, gender: ${r.gender}, is_online: ${r.is_online}`);
  });
  pool.end();
}
check();
