const db = require('../db');

async function checkSchema() {
    try {
        console.log('--- AGENCIES SCHEMA ---');
        const res = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agencies'");
        console.log(JSON.stringify(res.rows, null, 2));

        console.log('\n--- COMMISSION LOGS SCHEMA ---');
        const res2 = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'commission_logs'");
        console.log(JSON.stringify(res2.rows, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkSchema();
