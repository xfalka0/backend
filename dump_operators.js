const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:123456@dating-db.c7m0wqkscid4.eu-central-1.rds.amazonaws.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log('--- ALL OPERATORS ---');
        const res = await client.query(`
      SELECT u.id, u.username, u.display_name, u.avatar_url, o.category, o.photos 
      FROM users u 
      JOIN operators o ON u.id = o.user_id 
      ORDER BY u.id ASC
    `);
        console.log(JSON.stringify(res.rows, null, 2));
        console.log('Total Count:', res.rows.length);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
