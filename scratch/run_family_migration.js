const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to Render DB successfully!');

        const sqlFilePath = path.join(__dirname, '../migrations/create_family_tables.sql');
        const sql = fs.readFileSync(sqlFilePath, 'utf8');

        console.log('Running SQL Migration...');
        await client.query(sql);
        console.log('Family tables created successfully.');

    } catch (err) {
        console.error('Error executing migration:', err);
    } finally {
        await client.end();
    }
}

run();
