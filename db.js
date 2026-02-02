const { Pool } = require('pg');
require('dotenv').config();

const config = process.env.DATABASE_URL
  ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Render/Cloud DBs
  }
  : {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dating',
    password: process.env.DB_PASSWORD || '123',
    port: process.env.DB_PORT || 5432,
  };

const pool = new Pool(config);

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
