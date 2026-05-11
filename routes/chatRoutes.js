const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { sanitizeUser } = require('../utils/helpers');

// GET ALL CHATS (Admin)
router.get('/admin', authenticateToken, authorizeRole('admin', 'super_admin', 'operator', 'moderator', 'staff'), async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    try {
        let query = `
            SELECT c.*, 
                COALESCE(u.display_name, u.username, 'Bilinmeyen') as user_name, u.avatar_url as user_avatar,
                u.vip_level, u.age, u.gender, u.job, u.balance as user_balance,
                COALESCE(op.display_name, op.username, 'Bilinmeyen') as operator_name, op.avatar_url as operator_avatar,
                op.managed_by as managed_by_id,
                (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT COUNT(*)::int FROM messages WHERE chat_id = c.id AND sender_id = c.user_id AND is_read = false) as unread_count
            FROM chats c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN users op ON c.operator_id = op.id
        `;
        const params = [];
        if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            query += ` WHERE op.managed_by = $1 `;
            params.push(req.user.id);
        } else {
            // Admin/Super Admin should only see chats where the "operator_id" belongs to a management role
            // to prevent private user-to-user chats from showing up in the panel.
            query += ` WHERE EXISTS (SELECT 1 FROM messages m WHERE m.chat_id = c.id) 
                       AND op.role IN ('operator', 'staff', 'moderator', 'admin', 'super_admin') `;
        }
        query += ` ORDER BY c.last_message_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        const sanitizedRows = result.rows.map(row => {
            const userPart = sanitizeUser({ avatar_url: row.user_avatar }, req);
            const opPart = sanitizeUser({ avatar_url: row.operator_avatar }, req);
            return { ...row, user_avatar: userPart?.avatar_url || row.user_avatar, operator_avatar: opPart?.avatar_url || row.operator_avatar };
        });
        res.json(sanitizedRows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE OR GET CHAT
router.post('/', async (req, res) => {
    const { userId, operatorId } = req.body;
    try {
        const existing = await db.query('SELECT * FROM chats WHERE user_id = $1 AND operator_id = $2', [userId, operatorId]);
        if (existing.rows.length > 0) return res.json(existing.rows[0]);
        const newChat = await db.query('INSERT INTO chats (user_id, operator_id, last_message_at) VALUES ($1, $2, NOW()) RETURNING *', [userId, operatorId]);
        res.json(newChat.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MARK AS READ
router.put('/:chatId/read', async (req, res) => {
    const { chatId } = req.params;
    const { userId } = req.body;
    try {
        await db.query('UPDATE messages SET is_read = true WHERE chat_id = $1 AND sender_id != $2 AND is_read = false', [chatId, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
