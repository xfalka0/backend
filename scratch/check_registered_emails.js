const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function run() {
    console.log('--- CHECKING REGISTERED USERS AND ONBOARDING STATUS ---');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        // Query most recent 15 users
        const res = await client.query(`
            SELECT id, username, email, display_name, role, gender, onboarding_completed, created_at 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 15;
        `);
        console.table(res.rows);

        // Also check if there are any specific sude/sudenur accounts and their states
        const sudeRes = await client.query(`
            SELECT id, username, email, display_name, role, gender, onboarding_completed, created_at 
            FROM users 
            WHERE username ILIKE '%sude%' OR email ILIKE '%sude%' OR display_name ILIKE '%sude%';
        `);
        console.log('Sudenur accounts found:');
        console.table(sudeRes.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
