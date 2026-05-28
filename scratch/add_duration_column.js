const db = require('../db');
const { Client } = require('pg');

const productionConnectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function alterLocal() {
    console.log('--- ALTERING LOCAL DATABASE ---');
    try {
        await db.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS duration VARCHAR(10)');
        console.log('Local messages table altered successfully!');
    } catch (err) {
        console.error('Error altering local database:', err);
    }
}

async function alterProduction() {
    console.log('\n--- ALTERING PRODUCTION DATABASE ---');
    const client = new Client({
        connectionString: productionConnectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to Render DB successfully!');
        await client.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS duration VARCHAR(10)');
        console.log('Production messages table altered successfully!');
    } catch (err) {
        console.error('Error altering production database:', err);
    } finally {
        await client.end();
    }
}

async function main() {
    await alterLocal();
    await alterProduction();
    console.log('\nAltering completed!');
    process.exit(0);
}

main();
