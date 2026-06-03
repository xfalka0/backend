const { Client } = require('c:/Users/Falka/Desktop/dating/backend/node_modules/pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        const res = await client.query("SELECT * FROM otps WHERE identifier = 'fdnsmn00@gmail.com' ORDER BY created_at DESC LIMIT 5");
        console.log('OTPs in PROD for fdnsmn00@gmail.com:', res.rows);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
