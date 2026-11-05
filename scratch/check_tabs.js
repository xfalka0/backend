const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true'
});

async function check() {
  const targetGender = 'kadin';
  const userId = 853;
  const whereClause = `WHERE (LOWER(u.gender) = LOWER($1) OR u.gender = 'coin_bayisi' OR (LOWER($1) = 'kadin' AND LOWER(u.gender) IN ('kadin', 'kadın', 'female')) OR (LOWER($1) = 'erkek' AND LOWER(u.gender) IN ('erkek', 'male'))) AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff') AND (u.gender_confirmed_at IS NOT NULL OR u.role = 'operator' OR u.gender = 'coin_bayisi') AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $2 UNION SELECT blocker_id FROM blocks WHERE blocked_id = $2)`;

  const tabs = {
    'Yeni': 'ORDER BY u.created_at DESC, u.id DESC',
    'Popüler': 'ORDER BY u.vip_level DESC, o.rating DESC NULLS LAST, u.created_at DESC, u.id DESC',
    'Çevrimiçi': 'ORDER BY o.last_active_at DESC NULLS LAST, u.vip_level DESC, u.created_at DESC, u.id DESC',
    'Önerilen': 'ORDER BY o.is_online DESC NULLS LAST, (u.created_at >= NOW() - INTERVAL \'3 days\') DESC, COALESCE(active_boosts.val, FALSE) DESC, u.vip_level DESC, (coalesce(cardinality(o.photos), 0) > 0) DESC, u.created_at DESC, u.id DESC'
  };

  for (const [tab, order] of Object.entries(tabs)) {
    const q = `SELECT u.id, u.display_name FROM users u LEFT JOIN operators o ON u.id = o.user_id LEFT JOIN LATERAL (SELECT TRUE as val FROM boosts b WHERE b.user_id = u.id AND b.end_time > NOW() LIMIT 1) active_boosts ON TRUE ${whereClause} AND u.id != $2 AND u.account_status = 'active' ${tab === 'Çevrimiçi' ? 'AND o.is_online = TRUE' : ''} ${order}`;
    const res = await pool.query(q, [targetGender, userId]);
    console.log(`Tab: ${tab}, Last item:`, res.rows[res.rows.length - 1], 'Total:', res.rows.length);
    const bernaIdx = res.rows.findIndex(r => r.display_name === 'Berna');
    console.log(`Berna index in ${tab}:`, bernaIdx);
  }
  pool.end();
}
check();
