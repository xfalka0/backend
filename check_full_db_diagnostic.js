const db = require('./db');

async function checkFullDB() {
    try {
        console.log('--- TABLES ---');
        const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        const tableList = tables.rows.map(t => t.table_name);
        console.log(tableList);

        for (const tableName of tableList) {
            try {
                const count = await db.query(`SELECT COUNT(*) FROM ${tableName}`);
                console.log(`Table: ${tableName} | Count: ${count.rows[0].count}`);

                const colsRes = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}'`);
                const cols = colsRes.rows.map(c => c.column_name);
                console.log(`Columns for ${tableName}:`, cols);

                if (cols.includes('email') || cols.includes('name')) {
                    const searchCols = [];
                    if (cols.includes('email')) searchCols.push("email LIKE '%mustafa%'");
                    if (cols.includes('name')) searchCols.push("name LIKE '%mustafa%'");

                    const mustafa = await db.query(`SELECT * FROM ${tableName} WHERE ${searchCols.join(' OR ')}`);
                    if (mustafa.rows.length > 0) {
                        console.log(`FOUND MUSTAFA IN ${tableName}:`, JSON.stringify(mustafa.rows, null, 2));
                    }
                }
            } catch (tErr) {
                console.error(`Error checking table ${tableName}:`, tErr.message);
            }
        }
    } catch (err) {
        console.error('Error checking DB:', err);
    } finally {
        process.exit();
    }
}

checkFullDB();
