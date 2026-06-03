const { Pool } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function testVerify() {
  const email = 'furkandn012@gmail.com';
  const code = '736973'; // The OTP code from the database
  
  try {
    console.log(`Testing query: SELECT * FROM otps WHERE identifier = '${email}' AND otp_code = '${code}'`);
    
    // Query 1: Find by email and code only
    const res1 = await pool.query('SELECT * FROM otps WHERE identifier = $1 AND otp_code = $2', [email, code]);
    console.log('Query 1 (no expiration check) rows found:', res1.rows.length);
    if (res1.rows.length > 0) {
      console.log('Row details:', JSON.stringify(res1.rows[0], null, 2));
    }
    
    // Query 2: Full query including expires_at check
    const res2 = await pool.query('SELECT *, NOW() as db_now, expires_at > NOW() as valid_comparison FROM otps WHERE identifier = $1 AND otp_code = $2', [email, code]);
    console.log('Query 2 (with expiration check) rows found:', res2.rows.length);
    if (res2.rows.length > 0) {
      console.log('Row details with NOW:', JSON.stringify(res2.rows[0], null, 2));
    }
    
    // Query 3: Check timezone settings of this session
    const res3 = await pool.query("SHOW TIMEZONE");
    console.log('Session Timezone:', res3.rows[0].TimeZone);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

testVerify();
