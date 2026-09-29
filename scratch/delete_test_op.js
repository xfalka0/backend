const db = require('../db');

async function run() {
    try {
        const res = await db.query(
            "SELECT id, username, display_name, name, role, email FROM users WHERE display_name ILIKE '%test%' OR username ILIKE '%test%' OR name ILIKE '%test%' OR role ILIKE '%test%'"
        );
        console.log('Remaining test users:', res.rows);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}

run();
