const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function run() {
    console.log('--- DB DIAGNOSTIC ---');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        // 1. List users who have agency_id set
        console.log('Users linked to an agency:');
        const res = await client.query(`
            SELECT id, username, email, display_name, role, gender, agency_id 
            FROM users 
            WHERE agency_id IS NOT NULL;
        `);
        console.table(res.rows);

        // 2. All agencies
        console.log('All agencies:');
        const agenciesRes = await client.query(`
            SELECT id, name, referral_code, owner_id FROM agencies;
        `);
        console.table(agenciesRes.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
