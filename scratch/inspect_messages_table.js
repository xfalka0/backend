const db = require('../db');

async function run() {
    try {
        const res = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'messages'");
        console.log('COLUMNS IN MESSAGES TABLE:', res.rows);
    } catch (err) {
        console.error('Error fetching table info:', err);
    } finally {
        process.exit();
    }
}

run();
