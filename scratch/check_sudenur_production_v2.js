const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function run() {
    console.log('--- CONNECTING TO PRODUCTION RENDER DB (dating_db_j6yd) ---');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        // Inspect users table columns
        const colsRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log('Users Table Columns:');
        console.log(colsRes.rows.map(r => r.column_name).join(', '));

        // Search for user
        const searchUserRes = await client.query("SELECT * FROM users WHERE username ILIKE '%sude%' OR email ILIKE '%sude%'");
        console.log(`Found ${searchUserRes.rows.length} sude users:`);
        for (const user of searchUserRes.rows) {
            console.log({
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                gender: user.gender,
                agency_id: user.agency_id !== undefined ? user.agency_id : 'COLUMN MISSING',
                balance: user.balance
            });
        }

        // Print most recent 10 users overall
        console.log('--- 10 MOST RECENT USERS ---');
        const recentRes = await client.query("SELECT id, username, email, role, gender, created_at FROM users ORDER BY created_at DESC LIMIT 10");
        console.table(recentRes.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
