const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgres://dating_user:Tog402dM1xT3K6FidYqTq6N7D1K1I4I3@dpg-cv5hbeogph6c73dg0t1g-a.frankfurt-postgres.render.com/dating_eexy',
    ssl: { rejectUnauthorized: false }
});

async function checkStatus() {
    try {
        await client.connect();

        console.log('--- LATEST TRANSACTIONS ---');
        const trans = await client.query('SELECT id, user_id, amount, currency, status, created_at FROM transactions ORDER BY created_at DESC LIMIT 10');
        console.table(trans.rows);

        console.log('--- LATEST PAYMENTS ---');
        const payments = await client.query('SELECT * FROM payments ORDER BY created_at DESC LIMIT 10');
        console.table(payments.rows);

        console.log('--- LATEST USER UPDATES ---');
        const users = await client.query('SELECT id, email, balance, updated_at FROM users ORDER BY updated_at DESC LIMIT 5');
        console.table(users.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkStatus();
