const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:123@localhost:5432/dating'
});

async function migrate() {
  try {
    await client.connect();
    console.log('Connected to DB');
    await client.query('ALTER TABLE operators ALTER COLUMN pending_balance TYPE DECIMAL(12,2)');
    await client.query('ALTER TABLE operators ALTER COLUMN lifetime_earnings TYPE DECIMAL(12,2)');
    console.log('Migration successful: pending_balance changed to DECIMAL');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

migrate();
