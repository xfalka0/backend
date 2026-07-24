const db = require('../db');

async function main() {
    const senderId = 33;
    const receiverId = 65;
    const messageText = "Selam! Naber?";

    // Fetch user details for logging
    const uRes = await db.query('SELECT id, display_name, username, gender, role FROM users WHERE id IN ($1, $2)', [senderId, receiverId]);
    console.log('Users:', uRes.rows);

    const senderObj = uRes.rows.find(u => u.id === senderId);
    const receiverObj = uRes.rows.find(u => u.id === receiverId);

    // 1. Check or create chat
    let chatRes = await db.query(
        'SELECT id FROM chats WHERE (user_id = $1 AND operator_id = $2) OR (user_id = $2 AND operator_id = $1)',
        [senderId, receiverId]
    );

    let chatId;
    if (chatRes.rows.length > 0) {
        chatId = chatRes.rows[0].id;
        console.log('Existing chat found:', chatId);
    } else {
        const newChat = await db.query(
            'INSERT INTO chats (user_id, operator_id, created_at, last_message_at, last_message, unread_count) VALUES ($1, $2, NOW(), NOW(), $3, 1) RETURNING id',
            [senderId, receiverId, messageText]
        );
        chatId = newChat.rows[0].id;
        console.log('New chat created with ID:', chatId);
    }

    // 2. Insert message into messages table
    const msgRes = await db.query(
        'INSERT INTO messages (chat_id, sender_id, content, content_type, created_at, is_read) VALUES ($1, $2, $3, $4, NOW(), false) RETURNING *',
        [chatId, senderId, messageText, 'text']
    );

    // 3. Update chat last message & last_message_at
    await db.query(
        'UPDATE chats SET last_message = $1, last_message_at = NOW(), unread_count = unread_count + 1 WHERE id = $2',
        [messageText, chatId]
    );

    console.log('🎉 Message sent successfully:', msgRes.rows[0]);
    process.exit(0);
}

main().catch(err => {
    console.error('Error sending message:', err);
    process.exit(1);
});
