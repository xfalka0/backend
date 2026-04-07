
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'dating',
  password: String(process.env.DB_PASSWORD) || '123',
  port: process.env.DB_PORT || 5432,
});

async function updateAssignmentSchema() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('--- Adding Management Fields ---');
    // person_in_charge: Bu profilden sorumlu olan personelin UUID'si
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS managed_by UUID REFERENCES users(id) ON DELETE SET NULL;
    `);

    // Index ekleyerek hızlı sorgulama sağlayalım
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_managed_by ON users(managed_by);
    `);

    await client.query('COMMIT');
    console.log('✅ Zimmetleme altyapısı hazır. Artık profilleri personele atayabilirsin.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Hata:', e);
  } finally {
    client.release();
    process.exit();
  }
}

updateAssignmentSchema();
