const db = require('./db');

async function checkFullDB() {
    try {
        console.log('--- TABLES ---');
        const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log(tables.rows.map(t => t.table_name));

        for (const table of tables.rows) {
            const tableName = table.table_name;
            const count = await db.query(`SELECT COUNT(*) FROM ${tableName}`);
            console.log(`Table: ${tableName} | Count: ${count.rows[0].count}`);

            if (tableName === 'users' || tableName === 'operators') {
                const cols = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}'`);
                console.log(`Columns for ${tableName}:`, cols.rows.map(c => c.column_name));

                const mustafa = await db.query(`SELECT * FROM ${tableName} WHERE email LIKE '%mustafa%' OR name LIKE '%mustafa%'`);
                if (mustafa.rows.length > 0) {
                    console.log(`FOUND MUSTAFA IN ${tableName}:`, JSON.stringify(mustafa.rows, null, 2));
                }
            }
        }
    } catch (err) {
        console.error('Error checking DB:', err);
    } finally {
        process.exit();
    }
}

checkFullDB();
