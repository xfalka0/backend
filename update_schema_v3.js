const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function updateSchema() {
    const client = await pool.connect();
    try {
        console.log('Adding new columns to users table...');

        await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS relationship VARCHAR(50),
      ADD COLUMN IF NOT EXISTS zodiac VARCHAR(50),
      ADD COLUMN IF NOT EXISTS interests TEXT;
    `);

        console.log('Successfully added relationship, zodiac, and interests columns.');
    } catch (err) {
        console.error('Error updating schema:', err);
    } finally {
        client.release();
        pool.end();
    }
}

updateSchema();
