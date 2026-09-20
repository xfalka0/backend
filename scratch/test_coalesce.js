require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
    try {
        console.log("Running direct update...");
        const res = await pool.query("UPDATE users SET city = COALESCE($1, city) WHERE id = 43 RETURNING city", ['Bursa']);
        console.log("DB returned:", res.rows);
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
test();
