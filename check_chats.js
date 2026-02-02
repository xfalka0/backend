const db = require('./db');

async function checkDB() {
    try {
        console.log('--- DB CHECK ---');

        const users = await db.query('SELECT count(*) FROM users');
        console.log('User count:', users.rows[0].count);

        const operators = await db.query('SELECT count(*) FROM operators');
        console.log('Operator count:', operators.rows[0].count);

        const chats = await db.query('SELECT count(*) FROM chats');
        console.log('Chat count:', chats.rows[0].count);

        const messages = await db.query('SELECT count(*) FROM messages');
        console.log('Message count:', messages.rows[0].count);

        if (chats.rows[0].count > 0) {
            const lastChat = await db.query('SELECT * FROM chats ORDER BY created_at DESC LIMIT 1');
            console.log('Last Chat:', lastChat.rows[0]);
        }

        process.exit(0);
    } catch (err) {
        console.error('DB ERROR:', err.message);
        process.exit(1);
    }
}

checkDB();
