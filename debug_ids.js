const db = require('./db');

async function debugData() {
    try {
        console.log('--- USERS ---');
        const users = await db.query('SELECT id, username, role FROM users LIMIT 5');
        console.table(users.rows);

        console.log('--- CHATS ---');
        const chats = await db.query('SELECT id, user_id, operator_id FROM chats LIMIT 5');
        console.table(chats.rows);

        console.log('--- MESSAGES ---');
        const messages = await db.query('SELECT id, chat_id, sender_id, content FROM messages LIMIT 5');
        console.table(messages.rows);

        process.exit(0);
    } catch (err) {
        console.error('DEBUG ERROR:', err.message);
        process.exit(1);
    }
}

debugData();
