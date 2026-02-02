const db = require('./db');

async function cleanup() {
    try {
        console.log('--- Robust Data Cleanup ---');

        // 1. Fix display_name for all operators where it is NULL
        // We assume username is like "Name_1769..."
        const result = await db.query(`
            UPDATE users 
            SET display_name = SPLIT_PART(username, '_', 1)
            WHERE display_name IS NULL 
              AND role = 'operator'
              AND username LIKE '%\_%'
        `);
        console.log(`✅ Fixed display_name for ${result.rowCount} users.`);

        // 2. Clean up local URLs if any left
        const urlResult = await db.query(`
            UPDATE users 
            SET avatar_url = REPLACE(avatar_url, 'http://localhost:3000', '')
            WHERE avatar_url LIKE 'http://localhost:3000%'
        `);
        console.log(`✅ Cleaned up URLs for ${urlResult.rowCount} users.`);

        console.log('--- Cleanup complete. ---');
        process.exit(0);
    } catch (err) {
        console.error('Cleanup Error:', err);
        process.exit(1);
    }
}

cleanup();
