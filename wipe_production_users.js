const db = require('./db');

async function wipeData() {
    console.log('⚠️  STARTING PRODUCTION WIPE  ⚠️');
    console.log('This will delete all NON-ADMIN users and their data.');
    console.log('Waiting 3 seconds... Press Ctrl+C to cancel.');

    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
        await db.query('BEGIN');

        const safeDelete = async (table) => {
            try {
                await db.query(`DELETE FROM ${table}`);
                console.log(`✅ Cleaned ${table}`);
            } catch (err) {
                // 42P01 is "undefined_table"
                if (err.code === '42P01') {
                    console.log(`⚠️  Table '${table}' does not exist, skipping.`);
                } else {
                    console.error(`❌ Error cleaning ${table}:`, err.message);
                    throw err; // Rethrow critical errors
                }
            }
        };

        console.log('Cleaning up interactions...');
        await safeDelete('notifications');
        await safeDelete('activities');
        await safeDelete('story_likes');
        await safeDelete('post_likes');
        await safeDelete('post_comments');
        await safeDelete('messages');

        console.log('Cleaning up content...');
        await safeDelete('stories');
        await safeDelete('posts');
        await safeDelete('pending_photos');

        console.log('Cleaning up chats...');
        await safeDelete('chats');

        console.log('Cleaning up users (excluding admins)...');
        // Delete users who are NOT admins. This will cascade to operators table if configured, 
        // but typically we want to be explicit or rely on cascade. 
        // Operators table usually has ON DELETE CASCADE on user_id.
        const res = await db.query(`
            DELETE FROM users 
            WHERE role NOT IN ('admin', 'super_admin')
            RETURNING id, username, role
        `);

        console.log(`✅ Deleted ${res.rowCount} users/operators.`);

        await db.query('COMMIT');
        console.log('✅ WIPE COMPLETE. Database is clean for production.');
        console.log('ℹ️  Admins preserved.');

    } catch (err) {
        await db.query('ROLLBACK');
        console.error('❌ WIPE FAILED (Rolled back):', err);
    } finally {
        process.exit();
    }
}

wipeData();
