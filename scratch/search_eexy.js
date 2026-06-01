const { Client } = require('pg');

const connectionString = 'postgres://dating_user:Tog402dM1xT3K6FidYqTq6N7D1K1I4I3@dpg-cv5hbeogph6c73dg0t1g-a.frankfurt-postgres.render.com/dating_eexy?ssl=true';

async function run() {
    console.log('--- CONNECTING TO RENDER DB (dating_eexy) ---');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        // Query most recent 10 users in dating_eexy
        const res = await client.query(`
            SELECT id, username, email, display_name, role, gender, onboarding_completed, created_at 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 10;
        `);
        console.table(res.rows);

        // Check if there are any active OTPs in dating_eexy
        const otpsRes = await client.query('SELECT * FROM otps ORDER BY created_at DESC LIMIT 5');
        console.log('Recent OTPs in dating_eexy:');
        console.table(otpsRes.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
