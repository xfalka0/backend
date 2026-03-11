const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://dating_user:Tog402dM1xT3K6FidYqTq6N7D1K1I4I3@dpg-cv5hbeogph6c73dg0t1g-a.frankfurt-postgres.render.com/dating_eexy',
    ssl: { rejectUnauthorized: false }
});

async function checkStatus() {
    try {
        await client.connect();

        console.log('--- CHECKING RECENT BALANCE CHANGES (LAST 15 MIN) ---');
        const users = await client.query('SELECT id, balance, updated_at FROM users WHERE updated_at > NOW() - INTERVAL \'15 minutes\' ORDER BY updated_at DESC');
        if (users.rows.length === 0) {
            console.log('No users updated in the last 15 minutes.');
        } else {
            console.table(users.rows);
        }

        console.log('--- RECENT TRANSACTIONS ---');
        const trans = await client.query('SELECT id, user_id, amount, status, created_at FROM transactions WHERE created_at > NOW() - INTERVAL \'15 minutes\' ORDER BY created_at DESC');
        console.table(trans.rows);

    } catch (err) {
        console.error('Error during DB check:', err.message);
    } finally {
        await client.end();
    }
}

checkStatus();
