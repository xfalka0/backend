const db = require('../db');
const run = async () => {
    try {
        const res = await db.query('SELECT id, username, email, balance, role FROM users WHERE email = $1', ['sevansoguttlu@gmail.com']);
        if (res.rows.length === 0) {
            console.log('User not found');
            return;
        }
        const user = res.rows[0];
        console.log('User Details:', user);

        const chats = await db.query(`
            SELECT c.*, u.username as other_user 
            FROM chats c
            JOIN users u ON (c.user_id = u.id OR c.operator_id = u.id)
            WHERE (c.user_id = $1 OR c.operator_id = $1)
            AND u.id != $1
            ORDER BY c.last_message_at DESC LIMIT 5
        `, [user.id]);
        console.log('Recent Chats:', chats.rows);

        const messages = await db.query('SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 5', [chats.rows[0]?.id]);
        console.log('Last 5 Messages in top chat:', messages.rows);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
};
run();
