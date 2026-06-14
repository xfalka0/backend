const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true',
    ssl: { rejectUnauthorized: false }
});

async function inspectSchema() {
    try {
        await client.connect();
        console.log('Connected to Render Database successfully!');

        const tables = ['users', 'operators', 'posts', 'stories', 'post_likes', 'post_comments', 'story_likes', 'blocks'];

        for (const table of tables) {
            console.log(`\nChecking table: ${table}`);
            const res = await client.query(`
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

        await client.end();
    } catch (err) {
        console.error('Inspection failed:', err);
    }
}

inspectSchema();
