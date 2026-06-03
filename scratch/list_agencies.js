const db = require('../db');

async function run() {
    try {
        const res = await db.query('SELECT id, name, referral_code FROM agencies');
        console.log('Agencies in DB:', res.rows);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

run();
