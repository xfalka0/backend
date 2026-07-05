const { Pool } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

const CITIES = [
  'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Kocaeli', 
  'Gaziantep', 'Eskişehir', 'Muğla', 'Trabzon', 'Samsun', 'Aydın', 
  'Denizli', 'Balkesir', 'Mersin', 'Kayseri', 'Sakarya'
];

async function randomizeCities() {
  const client = await pool.connect();
  try {
    console.log('[DB] Fetching all operators...');
    const res = await client.query("SELECT id, display_name, city FROM users WHERE role = 'operator'");
    console.log(`[DB] Found ${res.rows.length} operators.`);

    for (const row of res.rows) {
      // Pick a random city
      const randomCity = CITIES[Math.floor(Math.random() * CITIES.length)];
      await client.query("UPDATE users SET city = $1 WHERE id = $2", [randomCity, row.id]);
      console.log(`[DB] Updated operator ${row.display_name} (ID: ${row.id}) city to ${randomCity}.`);
    }

    console.log('[DB] Finished randomizing cities!');
  } catch (err) {
    console.error('[DB] Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

randomizeCities();
