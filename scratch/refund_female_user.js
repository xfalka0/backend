const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function run() {
    console.log('--- REFUNDING FEMALE USER ---');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        // Update balance of user 591
        await client.query('UPDATE users SET balance = 9999 WHERE id = $1', ['591']);
        console.log('✅ User 591 balance successfully set to 9999.');

        // Print updated info
        const res = await client.query('SELECT id, username, gender, role, balance FROM users WHERE id = $1', ['591']);
        console.table(res.rows);

    } catch (err) {
        console.error('Error during refund:', err.message);
    } finally {
        await client.end();
    }
}

run();
