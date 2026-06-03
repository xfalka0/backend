const { Pool } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkDetails() {
  try {
    const tzRes = await pool.query("SHOW TIMEZONE");
    console.log('Database Timezone:', tzRes.rows[0].TimeZone);
    
    const timeRes = await pool.query("SELECT NOW() as now_tz, NOW()::timestamp as now_notz, CURRENT_TIMESTAMP as cur_ts");
    console.log('Database Times:', timeRes.rows[0]);
    
    const schemaRes = await pool.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'otps'
    `);
    console.log('OTPs Columns Schema:');
    console.log(schemaRes.rows);
    
    // Insert a test row using Node's Date object and query it back
    const testEmail = 'timezone_test@example.com';
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    
    await pool.query('DELETE FROM otps WHERE identifier = $1', [testEmail]);
    await pool.query('INSERT INTO otps (identifier, otp_code, expires_at) VALUES ($1, $2, $3)', [testEmail, '999999', expires]);
    
    const queryRes = await pool.query('SELECT *, expires_at > NOW() as is_valid, NOW() as current_now FROM otps WHERE identifier = $1', [testEmail]);
    console.log('Inserted test OTP:');
    console.log(JSON.stringify(queryRes.rows[0], null, 2));
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkDetails();
