const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { sanitizeUser } = require('../utils/helpers');
const { sendPushNotification } = require('../utils/notificationUtils');

// GET MESSAGES FOR A CHAT
router.get('/:chatId', async (req, res) => {
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    try {
        const result = await db.query(`
            SELECT * FROM (
                SELECT m.*, COALESCE(u.display_name, u.username, 'Bilinmeyen') as sender_name,
                    g.name as gift_name, g.cost as gift_cost, g.icon_url as gift_icon
                FROM messages m
                LEFT JOIN users u ON m.sender_id = u.id
                LEFT JOIN gifts g ON m.gift_id = g.id
                WHERE m.chat_id = $1 ORDER BY m.created_at DESC LIMIT $2 OFFSET $3
            ) sub ORDER BY created_at ASC
        `, [chatId, limit, offset]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST A MESSAGE (REST fallback - primarily socket.io used)
router.post('/', async (req, res) => {
    const { chatId, senderId, content, type } = req.body;
    if (!chatId || !senderId || !content) return res.status(400).json({ error: 'Missing parameters' });
    try {
        const result = await db.query(
            'INSERT INTO messages (chat_id, sender_id, content, content_type) VALUES ($1, $2, $3, $4) RETURNING *',
            [chatId, senderId, content, type || 'text']
        );
        await db.query('UPDATE chats SET last_message_at = NOW(), last_message = $2 WHERE id = $1', [chatId, content]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SEND HI MESSAGE
router.post('/send-hi', async (req, res) => {
    const { userId, senderId, operatorId, receiverId, content, message } = req.body;
    const finalSenderId = userId || senderId;
    const finalReceiverId = operatorId || receiverId;
    const finalContent = content || message || 'Merhaba 👋';
    const HI_COST = 10;

    if (!finalSenderId || !finalReceiverId) return res.status(400).json({ error: 'Missing sender or receiver ID' });

    try {
        await db.query('BEGIN');
        const userRes = await db.query('SELECT balance FROM users WHERE id = $1', [finalSenderId]);
        if (userRes.rows.length === 0) { await db.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }

        const currentBalance = userRes.rows[0].balance;
        if (currentBalance < HI_COST) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Yetersiz bakiye.', insufficientFunds: true });
        }

        let chatRes = await db.query(
            'SELECT id FROM chats WHERE (user_id = $1 AND operator_id = $2) OR (user_id = $2 AND operator_id = $1)',
            [finalSenderId, finalReceiverId]
        );
        let chatId;
        if (chatRes.rows.length === 0) {
            const newChat = await db.query('INSERT INTO chats (user_id, operator_id, last_message_at) VALUES ($1, $2, NOW()) RETURNING id', [finalSenderId, finalReceiverId]);
            chatId = newChat.rows[0].id;
        } else {
            chatId = chatRes.rows[0].id;
        }

        await db.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [HI_COST, finalSenderId]);
        const msgResult = await db.query('INSERT INTO messages (chat_id, sender_id, content, content_type) VALUES ($1, $2, $3, $4) RETURNING *', [chatId, finalSenderId, finalContent, 'text']);
        await db.query('UPDATE chats SET last_message_at = NOW() WHERE id = $1', [chatId]);
        await db.query('COMMIT');

        try {
            const senderRes = await db.query('SELECT display_name FROM users WHERE id = $1', [finalSenderId]);
            const senderName = senderRes.rows[0]?.display_name || 'Bir kullanıcı';
            await sendPushNotification(finalReceiverId, { title: 'Yeni Mesaj!', body: `${senderName}: ${finalContent}`, data: { chatId: chatId.toString(), type: 'message' } });
        } catch (e) { /* non-blocking */ }

        res.json({ success: true, chatId, newBalance: currentBalance - HI_COST, sentMessage: msgResult.rows[0] });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// INTERNAL FAKE MESSAGE
router.post('/internal-fake', async (req, res) => {
    const { userId, operatorId, content } = req.body;
    if (!userId || !operatorId || !content) return res.status(400).json({ error: 'Missing parameters' });
    try {
        let chatId;
        const chatCheck = await db.query('SELECT id FROM chats WHERE user_id = $1 AND operator_id = $2', [userId, operatorId]);
        if (chatCheck.rows.length === 0) {
            const newChat = await db.query('INSERT INTO chats (user_id, operator_id, last_message_at) VALUES ($1, $2, NOW()) RETURNING id', [userId, operatorId]);
            chatId = newChat.rows[0].id;
        } else {
            return res.json({ success: true, message: 'Already connected, skipping fake message.' });
        }
        const result = await db.query('INSERT INTO messages (chat_id, sender_id, content, content_type) VALUES ($1, $2, $3, $4) RETURNING *', [chatId, operatorId, content, 'text']);
        await db.query('UPDATE chats SET last_message_at = NOW(), last_message = $2 WHERE id = $1', [chatId, content]);
        const io = req.app.get('io');
        if (io) io.emit('new_message', { ...result.rows[0], chat_id: chatId.toString() });
        res.json({ success: true, message: result.rows[0], chatId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UNLOCK LOCKED MESSAGE
router.post('/:messageId/unlock', authenticateToken, async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.id;
    try {
        const msgRes = await db.query('SELECT * FROM messages WHERE id = $1', [messageId]);
        if (msgRes.rows.length === 0) return res.status(404).json({ error: 'Mesaj bulunamadı.' });
        const msg = msgRes.rows[0];
        if (msg.is_unlocked) return res.json({ success: true, message: msg });

        const unlockCost = msg.unlock_cost || 50;
        const userRes = await db.query('SELECT balance FROM users WHERE id = $1', [userId]);
        if (userRes.rows[0].balance < unlockCost) return res.status(400).json({ error: 'Yetersiz bakiye.', insufficientFunds: true });

        await db.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [unlockCost, userId]);
        const updated = await db.query('UPDATE messages SET is_unlocked = true WHERE id = $1 RETURNING *', [messageId]);
        res.json({ success: true, message: updated.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
