const { Client } = require('pg');
require('dotenv').config({ path: 'c:/Users/Falka/Desktop/dating/backend/.env' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function checkUsers() {
    try {
        await client.connect();

        // Check counts
        const countRes = await client.query('SELECT COUNT(*) FROM users');
        console.log('Total Users:', countRes.rows[0].count);

        // Check distinct names
        const nameRes = await client.query('SELECT display_name, COUNT(*) FROM users GROUP BY display_name');
        console.log('Distinct Names:', nameRes.rows);

        // Check operators
        const opRes = await client.query('SELECT u.display_name, o.category FROM operators o JOIN users u ON o.user_id = u.id');
        console.log('Operator Names:', opRes.rows.map(r => r.display_name));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkUsers();
