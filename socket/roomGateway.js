const jwt = require('jsonwebtoken');
const db = require('../db');
const { createClient } = require('redis');

const SECRET_KEY = process.env.JWT_SECRET || 'your_super_secret_key_change_in_prod';

// Optional Redis Client for idempotency key storage
let redisClient = null;
if (process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.connect().catch(err => console.error('[Gateway Redis] Connection failed:', err.message));
}

// In-memory fallbacks
const inMemoryIdempotencyKeys = new Set();
const chatMessageHistory = new Map(); // userId -> timestamp[]

// Middleware for Socket.io Authentication
const authenticateSocket = async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
        return next(new Error(JSON.stringify({ code: 'UNAUTHORIZED', message: 'Token bulunamadı.' })));
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        
        const result = await db.query(
            'SELECT id, username, role, account_status FROM users WHERE id::text = $1::text',
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return next(new Error(JSON.stringify({ code: 'USER_NOT_FOUND', message: 'Kullanıcı bulunamadı.' })));
        }

        const user = result.rows[0];

        if (user.account_status !== 'active') {
            return next(new Error(JSON.stringify({ code: 'USER_BANNED', message: 'Kullanıcı hesabı aktif değil.' })));
        }

        socket.user = {
            id: user.id,
            username: user.username,
            role: user.role
        };
        next();
    } catch (err) {
        return next(new Error(JSON.stringify({ code: 'INVALID_TOKEN', message: 'Geçersiz token.' })));
    }
};

function initializeRoomGateway(io) {
    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        console.log(`[RoomGateway] User connected: ${socket.user.username} (${socket.id})`);

        const sendError = (code, message) => {
            socket.emit('error_response', { code, message });
        };

        // 1. JOIN ROOM
        socket.on('join_room', async (data) => {
            const { roomId } = data;
            if (!roomId) {
                return sendError('BAD_REQUEST', 'RoomId gereklidir.');
            }

            const roomName = `room_${roomId}`;
            socket.join(roomName);

            try {
                // Check if room exists
                const roomRes = await db.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
                if (roomRes.rows.length === 0) {
                    return sendError('ROOM_NOT_FOUND', 'Oda bulunamadı.');
                }
                const room = roomRes.rows[0];

                // Upsert room membership
                await db.query(`
                    INSERT INTO room_members (room_id, user_id, role, joined_at, left_at)
                    VALUES ($1, $2, 'member', CURRENT_TIMESTAMP, NULL)
                    ON CONFLICT ON CONSTRAINT room_members_pkey DO UPDATE
                    SET left_at = NULL, joined_at = CURRENT_TIMESTAMP
                `, [roomId, socket.user.id]).catch(() => {
                    db.query(`
                        UPDATE room_members SET left_at = NULL, joined_at = CURRENT_TIMESTAMP
                        WHERE room_id = $1 AND user_id = $2
                    `, [roomId, socket.user.id]);
                });

                // Auto-write system log: "X odaya girdi"
                const systemMsgRes = await db.query(`
                    INSERT INTO room_messages (room_id, user_id, content, message_type)
                    VALUES ($1, NULL, $2, 'system')
                    RETURNING *
                `, [roomId, `${socket.user.username} odaya girdi`]);

                const savedSystemMsg = systemMsgRes.rows[0];

                // Broadcast system join message to others in the room
                io.to(roomName).emit('chat_broadcast', {
                    id: savedSystemMsg.id,
                    roomId: savedSystemMsg.room_id,
                    userId: null,
                    user_id: null,
                    content: savedSystemMsg.content,
                    messageType: 'system',
                    message_type: 'system',
                    username: 'Sistem',
                    createdAt: savedSystemMsg.created_at
                });

                // Fetch members
                const membersRes = await db.query(`
                    SELECT rm.*, u.username, u.display_name, u.avatar_url
                    FROM room_members rm
                    JOIN users u ON rm.user_id = u.id
                    WHERE rm.room_id = $1 AND rm.left_at IS NULL
                `, [roomId]);

                // Fetch seats
                const seatsRes = await db.query(`
                    SELECT rs.*, u.username, u.display_name, u.avatar_url
                    FROM room_seats rs
                    LEFT JOIN users u ON rs.user_id = u.id
                    WHERE rs.room_id = $1
                    ORDER BY rs.seat_index ASC
                `, [roomId]);

                // Fetch recent 50 messages (Phase 5 Requirement)
                const messagesRes = await db.query(`
                    SELECT rm.*, u.username, u.display_name, u.avatar_url
                    FROM room_messages rm
                    LEFT JOIN users u ON rm.user_id = u.id
                    WHERE rm.room_id = $1
                    ORDER BY rm.created_at DESC
                    LIMIT 50
                `, [roomId]);

                const onlineCount = io.sockets.adapter.rooms.get(roomName)?.size || 0;

                // Send room_response contract
                socket.emit('room_response', {
                    room: {
                        id: room.id,
                        name: room.name,
                        roomCode: room.room_code,
                        room_code: room.room_code,
                        ownerUserId: room.owner_user_id,
                        owner_user_id: room.owner_user_id,
                        roomType: room.room_type,
                        room_type: room.room_type,
                        status: room.status
                    },
                    members: membersRes.rows.map(row => ({
                        id: row.id,
                        roomId: row.room_id,
                        userId: row.user_id,
                        role: row.role,
                        username: row.username,
                        displayName: row.display_name
                    })),
                    seats: seatsRes.rows.map(row => ({
                        id: row.id,
                        seatIndex: row.seat_index,
                        userId: row.user_id,
                        isLocked: row.is_locked,
                        micOn: row.mic_on,
                        username: row.username,
                        displayName: row.display_name
                    })),
                    onlineCount,
                    recentMessages: messagesRes.rows.reverse().map(row => ({
                        id: row.id,
                        content: row.content,
                        senderId: row.user_id,
                        userId: row.user_id,
                        user_id: row.user_id,
                        messageType: row.message_type,
                        message_type: row.message_type,
                        username: row.username || 'Sistem',
                        displayName: row.display_name || 'Sistem',
                        createdAt: row.created_at
                    }))
                });

                io.to(roomName).emit('room_members_updated', { roomId, onlineCount });
            } catch (err) {
                console.error('[RoomGateway join_room error]:', err.message);
                sendError('INTERNAL_ERROR', 'Odaya katılım sırasında sunucu hatası oluştu.');
            }
        });

        // 2. LEAVE ROOM
        socket.on('leave_room', async (data) => {
            const { roomId } = data;
            if (!roomId) return sendError('BAD_REQUEST', 'RoomId gereklidir.');

            const roomName = `room_${roomId}`;
            socket.leave(roomName);

            try {
                await db.query(`
                    UPDATE room_members 
                    SET left_at = CURRENT_TIMESTAMP
                    WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
                `, [roomId, socket.user.id]);

                await db.query(`
                    UPDATE room_seats 
                    SET user_id = NULL, mic_on = false
                    WHERE room_id = $1 AND user_id = $2
                `, [roomId, socket.user.id]);

                const onlineCount = io.sockets.adapter.rooms.get(roomName)?.size || 0;
                io.to(roomName).emit('room_members_updated', { roomId, onlineCount });
            } catch (err) {
                console.error('[RoomGateway leave_room error]:', err.message);
            }
        });

        // 3. CHAT MESSAGE WITH FLOOD LIMIT AND CHAT BAN CHECK
        socket.on('chat', async (data) => {
            const { roomId, message, clientMessageId } = data;

            if (!roomId || !message || !message.trim()) {
                return sendError('BAD_REQUEST', 'Eksik parametreler (roomId veya message).');
            }

            try {
                // Check if user is chat banned in this room
                const memberRes = await db.query(`
                    SELECT is_chat_banned FROM room_members 
                    WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
                `, [roomId, socket.user.id]);

                if (memberRes.rows.length > 0 && memberRes.rows[0].is_chat_banned) {
                    return sendError('CHAT_BANNED', 'Bu odada mesaj göndermeniz yasaklanmıştır.');
                }

                // Flood Protection check
                const now = Date.now();
                const userHistory = chatMessageHistory.get(socket.user.id) || [];
                const recentTimestamps = userHistory.filter(t => now - t < 3000);
                
                if (recentTimestamps.length >= 5) {
                    return sendError('FLOOD_LIMIT_EXCEEDED', 'Çok hızlı mesaj gönderiyorsunuz. Lütfen bekleyin.');
                }

                recentTimestamps.push(now);
                chatMessageHistory.set(socket.user.id, recentTimestamps);

                // Insert message (message_type: 'text')
                const msgRes = await db.query(`
                    INSERT INTO room_messages (room_id, user_id, content, client_message_id, message_type)
                    VALUES ($1, $2, $3, $4, 'text')
                    RETURNING *
                `, [roomId, socket.user.id, message.trim(), clientMessageId || null]);

                const savedMsg = msgRes.rows[0];

                io.to(`room_${roomId}`).emit('chat_broadcast', {
                    id: savedMsg.id,
                    roomId: savedMsg.room_id,
                    userId: savedMsg.user_id,
                    user_id: savedMsg.user_id,
                    content: savedMsg.content,
                    clientMessageId: savedMsg.client_message_id,
                    messageType: 'text',
                    message_type: 'text',
                    username: socket.user.username,
                    createdAt: savedMsg.created_at
                });
            } catch (err) {
                console.error('[RoomGateway chat error]:', err.message);
                sendError('INTERNAL_ERROR', 'Mesaj gönderilemedi.');
            }
        });

        // 4. CHAT CLEAR (Owner/Admin restricted)
        socket.on('chat_clear', async (data) => {
            const { roomId } = data;
            if (!roomId) return sendError('BAD_REQUEST', 'RoomId gereklidir.');

            try {
                // Check if user is owner of the room or admin
                const roomRes = await db.query('SELECT owner_user_id FROM rooms WHERE id = $1', [roomId]);
                if (roomRes.rows.length === 0) {
                    return sendError('ROOM_NOT_FOUND', 'Oda bulunamadı.');
                }

                const isOwner = roomRes.rows[0].owner_user_id.toString() === socket.user.id.toString();
                const isAdmin = ['admin', 'super_admin'].includes(socket.user.role);

                const memberRes = await db.query(`
                    SELECT role FROM room_members 
                    WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
                `, [roomId, socket.user.id]);
                const callerRole = memberRes.rows[0]?.role;

                if (!isOwner && !isAdmin && callerRole !== 'admin' && callerRole !== 'owner') {
                    return sendError('UNAUTHORIZED', 'Sohbet geçmişini yalnızca oda yöneticileri temizleyebilir.');
                }

                // Delete room messages
                await db.query('DELETE FROM room_messages WHERE room_id = $1', [roomId]);

                // Create system log: "Oda sohbeti temizlendi"
                const systemMsgRes = await db.query(`
                    INSERT INTO room_messages (room_id, user_id, content, message_type)
                    VALUES ($1, NULL, 'Oda sohbeti temizlendi', 'system')
                    RETURNING *
                `, [roomId]);

                const savedMsg = systemMsgRes.rows[0];

                // Emit chat_cleared and broadcast system message
                io.to(`room_${roomId}`).emit('chat_cleared', { roomId });
                io.to(`room_${roomId}`).emit('chat_broadcast', {
                    id: savedMsg.id,
                    roomId: savedMsg.room_id,
                    userId: null,
                    user_id: null,
                    content: savedMsg.content,
                    messageType: 'system',
                    message_type: 'system',
                    username: 'Sistem',
                    createdAt: savedMsg.created_at
                });

            } catch (err) {
                console.error('[RoomGateway chat_clear error]:', err.message);
                sendError('INTERNAL_ERROR', 'Sohbet temizlenirken hata oluştu.');
            }
        });

        // 5. GIFT SENDING WITH IDEMPOTENCY AND AUTO SYSTEM MESSAGES
        socket.on('gift', async (data) => {
            const { roomId, receiverUserId, giftId, quantity = 1, idempotencyKey } = data;

            if (!roomId || !receiverUserId || !giftId || !idempotencyKey) {
                return sendError('BAD_REQUEST', 'Eksik parametreler (roomId, receiverUserId, giftId, veya idempotencyKey).');
            }

            if (redisClient && redisClient.isOpen) {
                const keyExists = await redisClient.get(`idempotency:${idempotencyKey}`);
                if (keyExists) {
                    console.log(`[Idempotency] Key ${idempotencyKey} already processed. Re-routing success.`);
                    return socket.emit('gift_success', { idempotencyKey, duplicate: true });
                }
            } else {
                if (inMemoryIdempotencyKeys.has(idempotencyKey)) {
                    console.log(`[Idempotency In-Memory] Key ${idempotencyKey} already processed.`);
                    return socket.emit('gift_success', { idempotencyKey, duplicate: true });
                }
            }

            const client = await db.pool.connect();
            try {
                await client.query('BEGIN');

                const giftRes = await client.query('SELECT * FROM gifts WHERE id = $1', [giftId]);
                if (giftRes.rows.length === 0) {
                    throw new Error('GIFT_NOT_FOUND');
                }
                const gift = giftRes.rows[0];
                const totalCost = gift.cost * quantity;

                const senderRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [socket.user.id]);
                if (senderRes.rows.length === 0) throw new Error('SENDER_NOT_FOUND');
                const senderBalance = parseFloat(senderRes.rows[0].balance || 0);

                if (senderBalance < totalCost) {
                    throw new Error('INSUFFICIENT_FUNDS');
                }

                await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [totalCost, socket.user.id]);

                const recRes = await client.query('SELECT username, gender, role, agency_id FROM users WHERE id = $1', [receiverUserId]);
                let receiverName = 'Alıcı';
                if (recRes.rows.length > 0) {
                    const recipient = recRes.rows[0];
                    receiverName = recipient.username;
                    const isFemale = (recipient.gender || '').toLowerCase() === 'kadin';
                    
                    if (isFemale) {
                        const baseRate = 4.35;
                        const earned = Math.round(totalCost * baseRate * 100) / 100;

                        await client.query(`
                            INSERT INTO operators (user_id, category, bio, photos, is_online, rating)
                            VALUES ($1, 'Genel', 'Merhaba!', '{}', false, 5.0)
                            ON CONFLICT (user_id) DO NOTHING
                        `, [receiverUserId]);

                        await client.query(`
                            UPDATE operators 
                            SET pending_balance = COALESCE(pending_balance, 0) + $1, 
                                lifetime_earnings = COALESCE(lifetime_earnings, 0) + $1 
                            WHERE user_id = $2
                        `, [earned, receiverUserId]);
                    }
                }

                await client.query(`
                    INSERT INTO transactions (user_id, amount, type, description)
                    VALUES ($1, $2, 'spend_gift', $3)
                `, [socket.user.id, -totalCost, `Oda hediye gönderimi: ${gift.name} x${quantity}`]);

                // Create Auto-written system log: "X, Y kullanıcısına gift gönderdi"
                const systemMsgContent = `${socket.user.username}, ${receiverName} kullanıcısına hediye gönderdi`;
                const systemMsgRes = await client.query(`
                    INSERT INTO room_messages (room_id, user_id, content, message_type, metadata_json)
                    VALUES ($1, NULL, $2, 'gift', $3)
                    RETURNING *
                `, [roomId, systemMsgContent, JSON.stringify({ giftName: gift.name, quantity, giftId })]);

                const savedSystemMsg = systemMsgRes.rows[0];

                await client.query('COMMIT');

                if (redisClient && redisClient.isOpen) {
                    await redisClient.set(`idempotency:${idempotencyKey}`, 'processed', { EX: 86400 });
                } else {
                    inMemoryIdempotencyKeys.add(idempotencyKey);
                    setTimeout(() => inMemoryIdempotencyKeys.delete(idempotencyKey), 86400 * 1000);
                }

                socket.emit('gift_success', { idempotencyKey, duplicate: false });

                // Broadcast gift event
                io.to(`room_${roomId}`).emit('gift_broadcast', {
                    roomId,
                    senderId: socket.user.id,
                    senderName: socket.user.username,
                    receiverUserId,
                    giftId,
                    quantity,
                    giftName: gift.name,
                    iconUrl: gift.icon_url
                });

                // Broadcast system gift log to everyone
                io.to(`room_${roomId}`).emit('chat_broadcast', {
                    id: savedSystemMsg.id,
                    roomId: savedSystemMsg.room_id,
                    userId: null,
                    user_id: null,
                    content: savedSystemMsg.content,
                    messageType: 'gift',
                    message_type: 'gift',
                    username: 'Sistem',
                    createdAt: savedSystemMsg.created_at
                });

            } catch (err) {
                await client.query('ROLLBACK');
                console.error('[RoomGateway gift error]:', err.message);

                if (err.message === 'GIFT_NOT_FOUND') {
                    sendError('GIFT_NOT_FOUND', 'Hediye bulunamadı.');
                } else if (err.message === 'INSUFFICIENT_FUNDS') {
                    sendError('INSUFFICIENT_FUNDS', `Yetersiz bakiye. Bu hediye için ${totalCost} coin gerekiyor.`);
                } else {
                    sendError('INTERNAL_ERROR', 'Hediye gönderilirken bir hata oluştu.');
                }
            } finally {
                client.release();
            }
        });

        // 6. DISCONNECT
        socket.on('disconnect', async () => {
            console.log(`[RoomGateway] User disconnected: ${socket.user.username} (${socket.id})`);
            try {
                await db.query(
                    'UPDATE room_seats SET user_id = NULL, mic_on = false WHERE user_id = $1 RETURNING room_id',
                    [socket.user.id]
                );

                await db.query(
                    'UPDATE room_members SET left_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND left_at IS NULL',
                    [socket.user.id]
                );
            } catch (err) {
                console.error('[RoomGateway presence clean up error]:', err.message);
            }
        });
    });
}

module.exports = { initializeRoomGateway };
