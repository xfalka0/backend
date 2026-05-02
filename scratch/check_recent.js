const db = require('../db');

async function checkRecentMessages() {
    try {
        console.log('--- RECENT MESSAGES ---');
        const res = await db.query('SELECT * FROM messages ORDER BY created_at DESC LIMIT 5');
        console.log(JSON.stringify(res.rows, null, 2));

        console.log('\n--- RECENT COMMISSION LOGS ---');
        const res2 = await db.query('SELECT * FROM commission_logs ORDER BY created_at DESC LIMIT 5');
        console.log(JSON.stringify(res2.rows, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkRecentMessages();
