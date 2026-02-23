const db = require('./db');

async function checkUser() {
    try {
        const result = await db.query("SELECT id, name, email, avatar_url, gender FROM users WHERE email LIKE '%mustafa%' OR name LIKE '%mustafa%'");
        console.log('--- MUSTAFA SEARCH RESULTS ---');
        console.log(JSON.stringify(result.rows, null, 2));

        const count = await db.query("SELECT COUNT(*) FROM users");
        console.log('Total Users:', count.rows[0].count);

        const latest = await db.query("SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 5");
        console.log('--- LATEST 5 USERS ---');
        console.log(JSON.stringify(latest.rows, null, 2));
    } catch (err) {
        console.error('Error checking user:', err);
    } finally {
        process.exit();
    }
}

checkUser();
