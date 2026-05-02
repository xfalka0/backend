const db = require('../db');

async function checkOperatorStatsSchema() {
    try {
        console.log('--- OPERATOR_STATS SCHEMA ---');
        const res = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'operator_stats'");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkOperatorStatsSchema();
