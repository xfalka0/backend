const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { sanitizeUser, logFreeMessagesExhausted } = require('../utils/helpers');
const { sendPushNotification } = require('../utils/notificationUtils');
const { recordOperatorCommission } = require('../utils/commissionUtils');
const { isUserPremiumActive } = require('../utils/vipUtils');
const { processAiAutoReply, scheduleAiNumaraHook } = require('../services/aiChatService');

const MANAGEMENT_ROLES = ['admin', 'super_admin', 'moderator', 'staff', 'operator'];
const isManagementRole = (role) => MANAGEMENT_ROLES.includes((role || '').toString().trim().toLowerCase());

const getRestMessageCost = (type) => {
    if (type === 'call_stub' || type === 'call_audio' || type === 'call_video') return 0;
    if (type === 'image' || type === 'locked_image') return 50;
    if (type === 'video' || type === 'locked_video') return 100;
    if (type === 'audio') return 30;
    if (type === 'location') return 400;
    return 10;
};
const { recordLockedPhotoInsufficientHit, recordLockedPhotoUnlock } = require('../services/lockedPhotoPromoService');

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

// POST A MESSAGE (REST fallback - enforces same coin rules as socket)
router.post('/', authenticateToken, async (req, res) => {
    const finalSenderId = req.user.id;
    const { chatId, content, type } = req.body;
    if (!chatId || !content) return res.status(400).json({ error: 'Missing parameters' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const userRes = await client.query(
            'SELECT balance, role, is_premium, premium_expire_date, vip_expire_date FROM users WHERE id = $1 FOR UPDATE',
            [finalSenderId]
        );
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found' });
        }

        const sender = userRes.rows[0];
        const isManagement = isManagementRole(sender.role);
        const cost = isManagement ? 0 : getRestMessageCost(type || 'text');

        if (!isManagement && type === 'location' && !isUserPremiumActive(sender)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Konum gönderebilmek için aktif Premium üye olmanız gerekmektedir.', requiresPremium: true });
        }

        let newBalance = parseFloat(sender.balance || 0);
        if (cost > 0) {
            if (newBalance < cost) {
                await client.query('ROLLBACK');
                logFreeMessagesExhausted(req.app.get('io'), finalSenderId, { channel: 'messages_rest', balance: newBalance, required: cost, messageType: type || 'text' }).catch(() => {});
                return res.status(400).json({ error: `Yetersiz bakiye. Bu işlem için ${cost} coin gerekli.`, insufficientFunds: true, required: cost });
            }

            const updRes = await client.query(
                'UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance',
                [cost, finalSenderId]
            );
            if (updRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Yetersiz bakiye. Bu işlem için ${cost} coin gerekli.`, insufficientFunds: true, required: cost });
            }
            newBalance = parseFloat(updRes.rows[0].balance);

            await client.query(
                'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
                [finalSenderId, -Math.round(cost), type === 'image' ? 'spend_image' : (type === 'audio' ? 'spend_audio' : 'spend_text'), 'Sohbet mesajı']
            );
        }

        const result = await client.query(
            'INSERT INTO messages (chat_id, sender_id, content, content_type) VALUES ($1, $2, $3, $4) RETURNING *',
            [chatId, finalSenderId, content, type || 'text']
        );
        await client.query('UPDATE chats SET last_message_at = NOW(), last_message = $2 WHERE id = $1', [chatId, content]);
        await client.query('COMMIT');

        const io = req.app.get('io');
        if (io && cost > 0) {
            io.emit('admin_balance_update', { userId: finalSenderId, newBalance });
            io.to(finalSenderId.toString()).emit('balance_update', { userId: finalSenderId, newBalance });
        }

        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// SEND HI MESSAGE
router.post('/send-hi', authenticateToken, async (req, res) => {
    const { operatorId, receiverId, content, message } = req.body;
    const finalSenderId = req.user.id;
    const finalReceiverId = operatorId || receiverId;
    const finalContent = content || message || 'Merhaba 👋';
    const HI_COST = 10;

    if (!finalReceiverId) return res.status(400).json({ error: 'Missing sender or receiver ID' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const userRes = await client.query('SELECT balance, role FROM users WHERE id = $1 FOR UPDATE', [finalSenderId]);
        if (userRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }

        const isManagement = isManagementRole(userRes.rows[0].role);
        const currentBalance = parseFloat(userRes.rows[0].balance || 0);
        const cost = isManagement ? 0 : HI_COST;

        if (cost > 0 && currentBalance < cost) {
            await client.query('ROLLBACK');
            logFreeMessagesExhausted(req.app.get('io'), finalSenderId, { channel: 'send_hi_route', balance: currentBalance, required: cost }).catch(() => {});
            return res.status(400).json({ error: 'Yetersiz bakiye.', insufficientFunds: true });
        }

        let chatRes = await client.query(
            'SELECT id FROM chats WHERE (user_id = $1 AND operator_id = $2) OR (user_id = $2 AND operator_id = $1)',
            [finalSenderId, finalReceiverId]
        );
        let chatId;
        if (chatRes.rows.length === 0) {
            const newChat = await client.query('INSERT INTO chats (user_id, operator_id, last_message_at) VALUES ($1, $2, NOW()) RETURNING id', [finalSenderId, finalReceiverId]);
            chatId = newChat.rows[0].id;
        } else {
            chatId = chatRes.rows[0].id;
        }

        let newBalance = currentBalance;
        if (cost > 0) {
            const updRes = await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance', [cost, finalSenderId]);
            if (updRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Yetersiz bakiye.', insufficientFunds: true });
            }
            newBalance = parseFloat(updRes.rows[0].balance);
            await client.query(
                'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
                [finalSenderId, -Math.round(cost), 'spend_text', 'Merhaba mesajı']
            );
        }

        const msgResult = await client.query('INSERT INTO messages (chat_id, sender_id, content, content_type) VALUES ($1, $2, $3, $4) RETURNING *', [chatId, finalSenderId, finalContent, 'text']);
        await client.query('UPDATE chats SET last_message_at = NOW(), last_message = $2 WHERE id = $1', [chatId, finalContent]);
        await client.query('COMMIT');

        try {
            const senderRes = await db.query('SELECT display_name FROM users WHERE id = $1', [finalSenderId]);
            const senderName = senderRes.rows[0]?.display_name || 'Bir kullanıcı';
            await sendPushNotification(finalReceiverId, { title: 'Yeni Mesaj!', body: `${senderName}: ${finalContent}`, data: { chatId: chatId.toString(), type: 'message' } });
        } catch (e) { /* non-blocking */ }

        // Trigger AI auto-reply for eligible new users on "Merhaba" / REST send
        const io = req.app.get('io');
        if (io && cost > 0) {
            io.emit('admin_balance_update', { userId: finalSenderId, newBalance });
            io.to(finalSenderId.toString()).emit('balance_update', { userId: finalSenderId, newBalance });
        }
        processAiAutoReply({
            io,
            chatId,
            userId: finalSenderId,
            operatorId: finalReceiverId,
            userMessage: finalContent
        }).catch(() => {});

        res.json({ success: true, chatId, newBalance, sentMessage: msgResult.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
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
        if (io) io.to(userId.toString()).emit('new_message', { ...result.rows[0], chat_id: chatId.toString() });
        res.json({ success: true, message: result.rows[0], chatId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UNLOCK LOCKED MESSAGE WITH ATOMIC TRANSACTION AND COMMISSION INTEGRATION
router.post('/:messageId/unlock', authenticateToken, async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user.id;
    
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const msgRes = await client.query('SELECT * FROM messages WHERE id = $1', [messageId]);
        if (msgRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Mesaj bulunamadı.' });
        }
        
        const msg = msgRes.rows[0];
        if (msg.is_unlocked) {
            await client.query('ROLLBACK');
            return res.json({ success: true, message: msg });
        }

        const unlockCost = msg.unlock_cost || 200;
        const userRes = await client.query('SELECT balance FROM users WHERE id = $1', [userId]);
        if (userRes.rows[0].balance < unlockCost) {
            await client.query('ROLLBACK');
            recordLockedPhotoInsufficientHit(messageId).catch(() => {});
            logFreeMessagesExhausted(req.app.get('io'), userId, { channel: 'unlock_media', balance: userRes.rows[0]?.balance || 0, required: unlockCost }).catch(() => {});
            if ((userRes.rows[0]?.balance || 0) <= 0) {
                const unlockOpId = msg.sender_id?.toString() !== userId.toString() ? msg.sender_id : null;
                scheduleAiNumaraHook({ io: req.app.get('io'), userId, chatId: msg.chat_id, operatorId: unlockOpId }).catch(() => {});
            }
            return res.status(400).json({ error: 'Yetersiz bakiye.', insufficientFunds: true });
        }

        // 1. Deduct Coins from Customer
        await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [unlockCost, userId]);
        await client.query(
            'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
            [userId, -Math.round(unlockCost), 'spend_unlock', 'Kilitli medya açma']
        );
        
        // 2. Mark Message as Unlocked
        const updated = await client.query('UPDATE messages SET is_unlocked = true WHERE id = $1 RETURNING *', [messageId]);

        // 3. Process Operator & Agency splits in PG Transaction client
        await recordOperatorCommission(client, msg.chat_id, userId, unlockCost, 'locked_image');

        await client.query('COMMIT');
        recordLockedPhotoUnlock(messageId).catch(() => {});

        const updatedMsg = updated.rows[0];

        // Broadcast to socket room and global io so operator panel & clients update in real time
        try {
            const io = req.app.get('io');
            if (io) {
                const unlockPayload = {
                    messageId: messageId.toString(),
                    chatId: msg.chat_id,
                    is_unlocked: true,
                    message: updatedMsg
                };
                io.to(msg.chat_id.toString()).emit('message_unlocked', unlockPayload);
                io.to(msg.chat_id.toString()).emit('message_updated', unlockPayload);
                io.emit('message_unlocked', unlockPayload);
            }
        } catch (socketErr) {
            console.error('[UNLOCK-SOCKET-ERROR]:', socketErr.message);
        }

        res.json({ success: true, message: updatedMsg });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[UNLOCK-COMMISSION-ERROR]:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;
