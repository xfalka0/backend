const db = require('../db');

async function checkUsers() {
    const names = ['İzzet', 'Bilal', 'Alpaslan', 'Faysal', 'Sefer', 'Dadaş'];
    console.log('--- Checking Users ---');
    for (const name of names) {
        const res = await db.query(
            "SELECT id, username, display_name, gender, role FROM users WHERE display_name ILIKE $1 OR username ILIKE $1",
            [`%${name}%`]
        );
        console.log(`Results for ${name}:`, JSON.stringify(res.rows));
    }
    process.exit(0);
}

checkUsers();
