const { Pool } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

const pool = new Pool({
  connectionString: connectionString,
});

async function inspectSchema() {
  const client = await pool.connect();
  try {
    console.log('--- Inspecting "users" Columns ---');
    const usersRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);
    console.log(usersRes.rows);

    console.log('--- Inspecting "party_room_seats" Columns ---');
    const opsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'party_room_seats';
    `);
    console.log(opsRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

inspectSchema();
