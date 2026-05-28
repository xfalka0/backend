const db = require('../db');

async function run() {
    try {
        const res = await db.query('SELECT * FROM coin_packages ORDER BY coins ASC');
        console.log('CURRENT COIN PACKAGES IN DB:', res.rows);
    } catch (err) {
        console.error('Error fetching coin packages:', err);
    } finally {
        process.exit();
    }
}

run();
