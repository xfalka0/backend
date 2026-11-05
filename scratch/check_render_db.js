const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true'
});

async function check() {
  try {
    const totalUsers = await pool.query('SELECT count(*) FROM users');
    console.log('Total users in Render DB:', totalUsers.rows[0].count);
    
    // Check how many female profiles exist
    const femaleUsers = await pool.query(`
      SELECT count(*) FROM users u 
      LEFT JOIN operators o ON u.id = o.user_id
      WHERE (LOWER(u.gender) = 'kadin' OR u.gender = 'coin_bayisi' OR LOWER(u.gender) IN ('kadin', 'kadın', 'female'))
        AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff')
        AND (u.gender_confirmed_at IS NOT NULL OR u.role = 'operator' OR u.gender = 'coin_bayisi')
        AND u.account_status = 'active'
    `);
    console.log('Matching female profiles in Render DB:', femaleUsers.rows[0].count);

    const sample = await pool.query(`
      SELECT u.id, u.username, u.display_name, u.gender, u.role, u.account_status, u.gender_confirmed_at
      FROM users u
      ORDER BY u.id DESC
      LIMIT 15
    `);
    console.log('Sample users in Render DB:', sample.rows);
  } catch (err) {
    console.error('Render DB Error:', err.message);
  } finally {
    pool.end();
  }
}
check();
