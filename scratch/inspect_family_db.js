const db = require('../db');

async function run() {
    try {
        const tables = ['families', 'family_members', 'family_applications', 'family_invites', 'family_xp_logs'];
        for (const table of tables) {
            console.log(`--- Schema for table: ${table} ---`);
            const res = await db.query(`
                SELECT column_name, data_type, character_maximum_length 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [table]);
            console.log(res.rows);
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

run();
