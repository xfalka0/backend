const db = require('../db');

async function listKadin() {
    console.log('--- Listing 20 Kadin Users ---');
    const res = await db.query(
        "SELECT id, username, display_name, gender, role FROM users WHERE gender = 'kadin' ORDER BY created_at DESC LIMIT 20"
    );
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
}

listKadin();
