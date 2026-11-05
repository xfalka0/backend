const db = require('../db');
async function check() {
  const q = await db.query(`
    SELECT u.id, u.username, u.display_name, u.gender, u.role, u.account_status, o.user_id as operator_user_id
    FROM users u 
    LEFT JOIN operators o ON u.id = o.user_id
    WHERE (LOWER(u.gender) = 'kadin' OR u.gender = 'coin_bayisi' OR LOWER(u.gender) IN ('kadin', 'kadın', 'female'))
      AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff')
      AND (u.gender_confirmed_at IS NOT NULL OR u.role = 'operator' OR u.gender = 'coin_bayisi')
      AND u.account_status = 'active'
  `);
  console.log('Matching users:', q.rows);
  
  const allUsers = await db.query(`SELECT id, username, display_name, gender, role, account_status, gender_confirmed_at FROM users`);
  console.log('All users in DB:', allUsers.rows);
  process.exit(0);
}
check();
