const db = require('../db');

async function inspect() {
    try {
        const commCols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'commission_logs'");
        console.log('COMMISSION LOGS COLUMNS:');
        console.log(commCols.rows);

        const statsCols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'operator_stats'");
        console.log('\nOPERATOR STATS COLUMNS:');
        console.log(statsCols.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

inspect();
