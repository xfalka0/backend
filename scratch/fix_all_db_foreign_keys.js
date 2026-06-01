const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to Render Production DB successfully!');

        // 1. Inspect ALL foreign key constraints in the database
        console.log('\n--- Inspecting All Foreign Key Constraints ---');
        const res = await client.query(`
            SELECT
                tc.constraint_name,
                tc.table_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                rc.delete_rule
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
                JOIN information_schema.referential_constraints AS rc
                  ON rc.constraint_name = tc.constraint_name
                  AND rc.constraint_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY';
        `);

        console.log(`Found ${res.rows.length} foreign key constraints in total:`);
        res.rows.forEach(row => {
            console.log(`  - ${row.constraint_name}: ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name} (ON DELETE ${row.delete_rule})`);
        });

        // 2. Identify the constraints that need to be changed to CASCADE
        const constraintsToCascade = res.rows.filter(row => {
            // If it's already CASCADE or SET NULL, we don't necessarily need to touch it
            if (row.delete_rule === 'CASCADE' || row.delete_rule === 'SET NULL') {
                return false;
            }
            // For agencies.owner_id, we might want SET NULL, but let's check what it currently is
            return true;
        });

        console.log(`\nFound ${constraintsToCascade.length} constraints to update to ON DELETE CASCADE:`);
        
        for (const item of constraintsToCascade) {
            console.log(`Updating constraint ${item.constraint_name} on table "${item.table_name}"...`);
            
            // Clean up any orphaned records before applying constraint to make sure it validates
            try {
                const deleteQuery = `DELETE FROM ${item.table_name} WHERE ${item.column_name} NOT IN (SELECT ${item.foreign_column_name} FROM ${item.foreign_table_name})`;
                const cleanRes = await client.query(deleteQuery);
                if (cleanRes.rowCount > 0) {
                    console.log(`  Cleaned ${cleanRes.rowCount} orphaned rows from ${item.table_name} (${item.column_name})`);
                }
            } catch (e) {
                console.log(`  Clean skipped or failed: ${e.message}`);
            }

            try {
                // Drop existing constraint
                await client.query(`ALTER TABLE ${item.table_name} DROP CONSTRAINT IF EXISTS ${item.constraint_name}`);
                
                // Add new constraint with ON DELETE CASCADE
                await client.query(`
                    ALTER TABLE ${item.table_name} 
                    ADD CONSTRAINT ${item.constraint_name} 
                    FOREIGN KEY (${item.column_name}) 
                    REFERENCES ${item.foreign_table_name}(${item.foreign_column_name}) 
                    ON DELETE CASCADE
                `);
                console.log(`  Successfully updated ${item.constraint_name} to ON DELETE CASCADE!`);
            } catch (err) {
                console.error(`  Failed to update ${item.constraint_name}:`, err.message);
            }
        }

        // Special check specifically for messages_chat_id_fkey if it wasn't captured or needs explicit treatment
        console.log('\n--- Double-checking messages_chat_id_fkey ---');
        try {
            console.log('Drop messages_chat_id_fkey if exists and add it with ON DELETE CASCADE');
            await client.query('ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_chat_id_fkey');
            await client.query('ALTER TABLE messages ADD CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE');
            console.log('  Successfully fixed messages_chat_id_fkey!');
        } catch (e) {
            console.error('  Failed to force fix messages_chat_id_fkey:', e.message);
        }

        console.log('\n--- SUCCESS: Database foreign key constraints updated! ---');

    } catch (err) {
        console.error('Operation Failed:', err);
    } finally {
        await client.end();
    }
}

run();
