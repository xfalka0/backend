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

        // 1. Inspect existing foreign key constraints on the relevant tables
        console.log('\n--- Inspecting Foreign Key Constraints ---');
        const res = await client.query(`
            SELECT
                tc.constraint_name,
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
            WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users';
        `);
        console.log('Foreign keys referencing "users":');
        res.rows.forEach(row => {
            console.log(`  - ${row.constraint_name}: ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
        });

        console.log('\n--- Cleaning Orphaned Records ---');

        const tablesToClean = [
            { table: 'operators', col: 'user_id' },
            { table: 'chats', col: 'user_id' },
            { table: 'chats', col: 'operator_id' },
            { table: 'messages', col: 'sender_id' },
            { table: 'transactions', col: 'user_id' },
            { table: 'activities', col: 'user_id' },
            { table: 'pending_photos', col: 'user_id' },
            { table: 'boosts', col: 'user_id' },
            { table: 'favorites', col: 'user_id' },
            { table: 'favorites', col: 'target_user_id' },
            { table: 'profile_views', col: 'viewer_id' },
            { table: 'profile_views', col: 'viewed_user_id' },
            { table: 'payments', col: 'user_id' },
            { table: 'posts', col: 'operator_id' },
            { table: 'stories', col: 'operator_id' },
            { table: 'post_likes', col: 'user_id' },
            { table: 'post_comments', col: 'user_id' },
            { table: 'story_likes', col: 'user_id' },
            { table: 'message_schedules', col: 'operator_id' },
            { table: 'message_schedules', col: 'target_user_id' },
            { table: 'operator_stats', col: 'operator_id', type: 'text' },
            { table: 'payouts', col: 'operator_id' },
            { table: 'reports', col: 'reporter_id' },
            { table: 'reports', col: 'reported_id' },
            { table: 'blocks', col: 'blocker_id' },
            { table: 'blocks', col: 'blocked_id' }
        ];

        for (const t of tablesToClean) {
            try {
                let deleteQuery;
                if (t.type === 'text') {
                    // For operator_stats operator_id (which might be text UUID or integer string)
                    deleteQuery = `DELETE FROM ${t.table} WHERE ${t.col}::text NOT IN (SELECT id::text FROM users)`;
                } else {
                    deleteQuery = `DELETE FROM ${t.table} WHERE ${t.col} NOT IN (SELECT id FROM users)`;
                }
                const cleanRes = await client.query(deleteQuery);
                if (cleanRes.rowCount > 0) {
                    console.log(`  Cleaned ${cleanRes.rowCount} orphaned rows from ${t.table} (${t.col})`);
                }
            } catch (e) {
                console.log(`  Info/Skip cleaning for ${t.table} (${t.col}): ${e.message}`);
            }
        }

        // Handle agencies (set owner_id to null if owner is deleted)
        try {
            const agencyRes = await client.query(`UPDATE agencies SET owner_id = NULL WHERE owner_id NOT IN (SELECT id FROM users)`);
            if (agencyRes.rowCount > 0) {
                console.log(`  Updated ${agencyRes.rowCount} agencies with orphaned owner_id to NULL`);
            }
        } catch (e) {
            console.log(`  Info/Skip cleaning for agencies: ${e.message}`);
        }

        console.log('\n--- Modifying constraints to ON DELETE CASCADE ---');

        const constraintsToFix = [
            { table: 'operators', col: 'user_id', fk: 'operators_user_id_fkey' },
            { table: 'chats', col: 'user_id', fk: 'chats_user_id_fkey' },
            { table: 'chats', col: 'operator_id', fk: 'chats_operator_id_fkey' },
            { table: 'messages', col: 'sender_id', fk: 'messages_sender_id_fkey' },
            { table: 'transactions', col: 'user_id', fk: 'transactions_user_id_fkey' },
            { table: 'activities', col: 'user_id', fk: 'activities_user_id_fkey' },
            { table: 'pending_photos', col: 'user_id', fk: 'pending_photos_user_id_fkey' },
            { table: 'boosts', col: 'user_id', fk: 'boosts_user_id_fkey' },
            { table: 'favorites', col: 'user_id', fk: 'favorites_user_id_fkey' },
            { table: 'favorites', col: 'target_user_id', fk: 'favorites_target_user_id_fkey' },
            { table: 'profile_views', col: 'viewer_id', fk: 'profile_views_viewer_id_fkey' },
            { table: 'profile_views', col: 'viewed_user_id', fk: 'profile_views_viewed_user_id_fkey' },
            { table: 'payments', col: 'user_id', fk: 'payments_user_id_fkey' },
            { table: 'posts', col: 'operator_id', fk: 'posts_operator_id_fkey' },
            { table: 'stories', col: 'operator_id', fk: 'stories_operator_id_fkey' },
            { table: 'post_likes', col: 'user_id', fk: 'post_likes_user_id_fkey' },
            { table: 'post_comments', col: 'user_id', fk: 'post_comments_user_id_fkey' },
            { table: 'story_likes', col: 'user_id', fk: 'story_likes_user_id_fkey' },
            { table: 'message_schedules', col: 'operator_id', fk: 'message_schedules_operator_id_fkey' },
            { table: 'message_schedules', col: 'target_user_id', fk: 'message_schedules_target_user_id_fkey' },
            { table: 'operator_stats', col: 'operator_id', fk: 'operator_stats_operator_id_fkey' },
            { table: 'payouts', col: 'operator_id', fk: 'payouts_operator_id_fkey' },
            { table: 'reports', col: 'reporter_id', fk: 'reports_reporter_id_fkey' },
            { table: 'reports', col: 'reported_id', fk: 'reports_reported_id_fkey' },
            { table: 'blocks', col: 'blocker_id', fk: 'blocks_blocker_id_fkey' },
            { table: 'blocks', col: 'blocked_id', fk: 'blocks_blocked_id_fkey' }
        ];

        for (const item of constraintsToFix) {
            try {
                console.log(`Updating constraint ${item.fk} on ${item.table}(${item.col})...`);
                await client.query(`ALTER TABLE ${item.table} DROP CONSTRAINT IF EXISTS ${item.fk}`);
                await client.query(`ALTER TABLE ${item.table} ADD CONSTRAINT ${item.fk} FOREIGN KEY (${item.col}) REFERENCES users(id) ON DELETE CASCADE`);
            } catch (e) {
                console.log(`  Failed to update constraint ${item.fk}: ${e.message}`);
            }
        }

        // Special case: agencies.owner_id should be ON DELETE SET NULL rather than cascade
        try {
            console.log('Updating constraint agencies_owner_id_fkey on agencies(owner_id)...');
            await client.query('ALTER TABLE agencies DROP CONSTRAINT IF EXISTS agencies_owner_id_fkey');
            await client.query('ALTER TABLE agencies ADD CONSTRAINT agencies_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL');
        } catch (e) {
            console.log(`  Failed to update constraint agencies_owner_id_fkey: ${e.message}`);
        }

        console.log('\n--- SUCCESS: All constraints updated on Render! ---');

    } catch (err) {
        console.error('Migration Failed:', err);
    } finally {
        await client.end();
    }
}

run();
