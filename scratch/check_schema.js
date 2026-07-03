const db = require('../db');

async function main() {
    try {
        const tables = ['users', 'posts', 'blocks', 'stories'];
        for (const t of tables) {
            console.log(`\n--- SCHEMA OF TABLE: ${t} ---`);
            const res = await db.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [t]);
            console.table(res.rows);
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
