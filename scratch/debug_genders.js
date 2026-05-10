const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({
    connectionString: 'postgresql://postgres:123@localhost:5432/dating'
});

async function checkUsers() {
    try {
        await client.connect();
        const res = await client.query("SELECT id, username, display_name, gender, role FROM users LIMIT 50");
        console.log('--- All Users (First 50) ---');
        console.table(res.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkUsers();
