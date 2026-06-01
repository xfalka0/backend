const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function run() {
    console.log('--- CONNECTING TO PRODUCTION RENDER DB ---');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        // 1. Inspect agencies columns
        const colsRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'agencies'
        `);
        console.log('Agencies Columns:');
        console.table(colsRes.rows);

        // 2. Fetch existing agencies
        const agenciesRes = await client.query("SELECT * FROM agencies");
        console.log('Existing Agencies:');
        console.table(agenciesRes.rows);

        // 3. Inspect users columns again just to be absolutely sure
        const usersColsRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'agency_id'
        `);
        console.log('Users agency_id Column status:', usersColsRes.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
