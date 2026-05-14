const db = require('../db');

async function listUsers() {
    console.log('--- Listing 50 Users ---');
    const res = await db.query(
        "SELECT id, username, display_name, gender, role FROM users ORDER BY created_at DESC LIMIT 50"
    );
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
}

listUsers();
