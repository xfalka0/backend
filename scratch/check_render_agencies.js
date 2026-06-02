const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function check() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    const res = await client.query('SELECT id, name, pending_balance, lifetime_earnings, owner_id, status, created_at FROM agencies ORDER BY created_at');
    console.log('Agencies in Render DB:');
    console.log(res.rows);

    const modelsRes = await client.query('SELECT id, username, role, agency_id FROM users WHERE agency_id IS NOT NULL');
    console.log('Models linked to agencies:');
    console.log(modelsRes.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

check();
