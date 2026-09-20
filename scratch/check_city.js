require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query("SELECT id, username, city FROM users WHERE role = 'operator'")
    .then(res => {
        console.table(res.rows);
        pool.end();
    })
    .catch(e => {
        console.error(e);
        pool.end();
    });
