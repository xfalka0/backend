const db = require('../db');

async function checkChatIds() {
    try {
        console.log('--- CHAT IDS ---');
        const res = await db.query('SELECT id, user_id, operator_id FROM chats LIMIT 10');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkChatIds();
