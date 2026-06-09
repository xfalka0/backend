const { Pool } = require('pg');
const logger = require('./utils/logger');
require('dotenv').config();

// Connection config
const config = process.env.DATABASE_URL
  ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: parseInt(process.env.DB_POOL_MAX) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONN_TIMEOUT) || 5000,
  }
  : {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dating',
    password: process.env.DB_PASSWORD || '123',
    port: process.env.DB_PORT || 5432,
    ssl: false,
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

if (!process.env.DATABASE_URL) {
  logger.info('[DB] DATABASE_URL missing, using local configuration');
} else {
  logger.info('[DB] Connecting to database via DATABASE_URL');
}

const pool = new Pool(config);

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle database client: ' + err.message);
  // Do not exit process immediately under high load, log and let express handle reconnects
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
