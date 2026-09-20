require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
    const res = await pool.query("SELECT id, username, display_name, city FROM users WHERE id = 607 OR display_name ILIKE '%dilek%'");
    console.log("Found users:", res.rows);
    pool.end();
}
check();
