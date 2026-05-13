const db = require('../db');

async function fixTypes() {
    try {
        console.log('Starting DB fix...');
        
        // 1. Ensure referred_by is UUID
        await db.query(`
            ALTER TABLE users 
            ALTER COLUMN referred_by TYPE UUID 
            USING (CASE WHEN referred_by::text ~ '^[0-9a-fA-F-]{36}$' THEN referred_by::uuid ELSE NULL END)
        `);
        console.log('[OK] referred_by is definitely UUID');

        // 2. Fix adminUsers.js logic
        // I'll do this in a separate step with replace_file_content
        
        console.log('Fix complete!');
        process.exit(0);
    } catch (err) {
        console.error('Fix failed:', err.message);
        process.exit(1);
    }
}

fixTypes();
