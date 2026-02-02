const db = require('./db');

async function inspectSchema() {
    try {
        console.log("--- DATABASE SCHEMA INSPECTION ---");

        const tables = ['users', 'operators', 'chats', 'messages', 'activities', 'pending_photos'];

        for (const table of tables) {
            console.log(`\nChecking table: ${table}`);
            const res = await db.query(`
                SELECT column_name, data_type, character_maximum_length, is_nullable
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position;
            `, [table]);

            if (res.rows.length === 0) {
                console.log(`Table ${table} NOT FOUND.`);
                continue;
            }

            res.rows.forEach(row => {
                console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
            });
        }

        console.log("\n--- FOREIGN KEYS ---");
        const fks = await db.query(`
            SELECT
                tc.table_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY';
        `);

        fks.rows.forEach(row => {
            console.log(`  - ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
        });

        process.exit(0);
    } catch (err) {
        console.error("Inspection failed:", err.message);
        process.exit(1);
    }
}

inspectSchema();
