const { Pool } = require('pg');
require('dotenv').config();

// STRICT PRODUCTION CONFIG (RENDER ONLY)
const config = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Render/Cloud DBs
};

if (!process.env.DATABASE_URL) {
  console.error('❌ [CRITICAL] DATABASE_URL is missing! Server cannot connect to production DB.');
}

const pool = new Pool(config);

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
