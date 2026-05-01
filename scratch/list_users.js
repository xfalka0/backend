const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dating',
    password: process.env.DB_PASSWORD || '123',
    port: process.env.DB_PORT || 5432,
    ssl: false
});

async function listUsers() {
    try {
        await client.connect();
        const res = await client.query("SELECT username, email, role FROM users");
        console.table(res.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

listUsers();
