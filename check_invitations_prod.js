const { Pool } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkInvitations() {
  try {
    const inviteRes = await pool.query(`
      SELECT ai.id, ai.agency_id, ai.operator_id, ai.status, ai.created_at,
             a.name as agency_name, a.owner_id
      FROM agency_invitations ai
      JOIN agencies a ON ai.agency_id::text = a.id::text
      WHERE ai.status = 'pending'
    `);
    console.log('Pending invitations in DB:');
    console.log(inviteRes.rows);
    
    if (inviteRes.rows.length > 0) {
      const ownerId = inviteRes.rows[0].owner_id;
      console.log('Owner ID to lookup:', ownerId);
      
      const userRes = await pool.query('SELECT id, username, display_name, avatar_url FROM users WHERE id::text = $1::text', [ownerId]);
      console.log('Owner user details in DB:');
      console.log(userRes.rows);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkInvitations();
