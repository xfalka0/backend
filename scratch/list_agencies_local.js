const { Client } = require('pg');
require('dotenv').config({ path: 'c:/Users/Falka/Desktop/dating/backend/.env' });

const config = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dating',
    password: process.env.DB_PASSWORD || '123',
    port: process.env.DB_PORT || 5432,
    ssl: false
};

const client = new Client(config);

async function run() {
    try {
        await client.connect();
        const res = await client.query('SELECT * FROM agencies');
        console.log('Agencies in LOCAL:', res.rows);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
