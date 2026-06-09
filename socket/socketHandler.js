const db = require('../db');
const { recordOperatorCommission } = require('../utils/commissionUtils');
const { sendPushNotification } = require('../utils/notificationUtils');

function initializeSockets(io) {
    io.on('connection', (socket) => {
        const connLog = {
            timestamp: new Date().toISOString(),
            type: 'CLIENT_CONNECTED',
            socketId: socket.id,
            user: socket.user ? { id: socket.user.id, username: socket.user.username } : 'ANONYMOUS'
        };
        if (!global.payoutLogs) global.payoutLogs = [];
        global.payoutLogs.push(connLog);
        
        console.log(`[SOCKET] User connected: ${socket.id} (Authenticated: ${socket.user ? socket.user.username : 'NO'})`);

        // Join their own room for global notifications
        if (socket.user && socket.user.id) {
            const userRoom = socket.user.id.toString();
            socket.join(userRoom);
            console.log(`[SOCKET] User ${socket.user.username} joined personal room: ${userRoom}`);
        }

        socket.on('join_room', (chatId) => {
            if (!chatId) {
                console.error(`[SOCKET] User ${socket.user?.username || socket.id} tried to join an empty room!`);
                return;
            }
            const roomName = chatId.toString();
            socket.join(roomName);
            console.log(`[SOCKET] User ${socket.user?.username || socket.id} (${socket.id}) joined room: ${roomName}`);
        });

        socket.on('leave_room', (chatId) => {
            if (!chatId) return;
            const roomName = chatId.toString();
            socket.leave(roomName);
            console.log(`[SOCKET] User ${socket.user?.username || socket.id} (${socket.id}) left room: ${roomName}`);
        });

        // --- TYPING INDICATOR (YAZIYOR...) ---
        socket.on('typing_start', (data) => {
            const chatId = data.chatId ? data.chatId.toString() : null;
            if (!chatId) return;

            console.log(`[SOCKET] typing_start received from ${socket.user?.username || socket.id} for chatId: ${chatId}`);
            socket.to(chatId).emit('display_typing', {
                userId: socket.user ? socket.user.id.toString() : null,
                chatId: chatId
            });
        });

        socket.on('typing_end', (data) => {
            const chatId = data.chatId ? data.chatId.toString() : null;
            if (!chatId) return;

            console.log(`[SOCKET] typing_end received from ${socket.user?.username || socket.id} for chatId: ${chatId}`);
            socket.to(chatId).emit('hide_typing', {
                userId: socket.user ? socket.user.id.toString() : null,
                chatId: chatId
            });
        });

        // Send Message
        socket.on('send_message', async (data) => {
            console.log('[SOCKET] send_message received:', JSON.stringify(data, null, 2));
            const { chatId, content, type, giftId, tempId, unlockCost, duration } = data;
            const senderId = socket.user.id;

            console.log(`[DEBUG-SEND] chatId: ${chatId} (${typeof chatId}), senderId: ${senderId} (${typeof senderId}), type: ${type}`);
            if (!global.payoutLogs) global.payoutLogs = [];
            global.payoutLogs.push({ timestamp: new Date().toISOString(), type: 'DEBUG_SEND', data: { chatId, senderId, contentType: type, chatIdType: typeof chatId } });
            global.payoutLogs.push({
                timestamp: new Date().toISOString(),
                type: 'SEND_MESSAGE_START',
                chatId,
                senderId,
                contentType: type
            });

            let client;

            try {
                client = await db.pool.connect();
                console.log(`[SOCKET] Starting send_message transaction for chatId: ${chatId}, senderId: ${senderId}`);
                await client.query('BEGIN'); // Start Transaction

                // Load chat details, user genders, roles, and managers in ONE query
                const chatRes = await client.query(`
                    SELECT c.user_id, c.operator_id, 
                           u1.gender as user_gender, u2.gender as operator_gender,
                           u1.role as user_role, u2.role as operator_role,
                           u2.managed_by as operator_managed_by
                    FROM chats c
                    LEFT JOIN users u1 ON c.user_id = u1.id
                    LEFT JOIN users u2 ON c.operator_id = u2.id
                    WHERE c.id = $1
                `, [chatId]);

                let isFemaleToFemale = false;
                let chatReceiverId = null;
                let operatorManagedBy = null;

                if (chatRes.rows.length > 0) {
                    const chat = chatRes.rows[0];
                    const isSenderUser = senderId.toString() === chat.user_id.toString();
                    const receiverId = isSenderUser ? chat.operator_id : chat.user_id;
                    chatReceiverId = receiverId;
                    operatorManagedBy = chat.operator_managed_by;

                    const senderGender = isSenderUser ? chat.user_gender : chat.operator_gender;
                    const receiverGender = isSenderUser ? chat.operator_gender : chat.user_gender;
                    
                    isFemaleSender = (senderGender || '').toLowerCase() === 'kadin';
                    const isFemaleReceiver = (receiverGender || '').toLowerCase() === 'kadin';

                    if (isFemaleSender && isFemaleReceiver) {
                        isFemaleToFemale = true;
                        console.log(`[SOCKET] Female-to-Female messaging detected in chat ${chatId} (Sender: ${senderId}, Receiver: ${receiverId}). Coins will be charged.`);
                    }
                }

                let cost = 0;
                let userBalance = 0;
                let currentBalance = 0;
                let giftDetails = null;

                // --- 1. COIN DEDUCTION LOGIC ---
                const userRole = (socket.user.role || '').toLowerCase();
                
                // Strictly role-based management check (staff/operators), disabled if female-to-female conversation
                const isManagement = !isFemaleToFemale && ['admin', 'super_admin', 'moderator', 'staff', 'operator'].includes(userRole);
                
                // Free sender: Management OR any female messaging a male (not female-to-female)
                const isFreeSender = isManagement || (isFemaleSender && !isFemaleToFemale);
                
                let commissionDataToRunLater = null;
                
                if (!isFreeSender) {
                    cost = 10; // Default text
                    if (type === 'gift' && giftId) {
                        const giftRes = await client.query('SELECT * FROM gifts WHERE id = $1', [giftId]);
                        if (giftRes.rows.length > 0) {
                            giftDetails = giftRes.rows[0];
                            cost = giftDetails.cost;
                        } else {
                            throw new Error('Invalid Gift ID');
                        }
                    } else if (type === 'image') {
                        cost = 50;
                    } else if (type === 'audio') {
                        cost = 30;
                    }

                    const userResult = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [senderId]);
                    if (userResult.rows.length === 0) throw new Error('User not found');

                    currentBalance = parseFloat(userResult.rows[0].balance || 0);
                    console.log(`[PAYOUT-DEBUG] Sender ${senderId} (Role: ${socket.user.role}) current balance: ${currentBalance}, cost: ${cost}`);

                    if (currentBalance < cost) {
                        console.log(`[PAYOUT-DEBUG] Insufficient funds for ${senderId}. Has ${currentBalance}, needs ${cost}`);
                        await client.query('ROLLBACK');
                        io.to(socket.id).emit('message_error', {
                            code: 'INSUFFICIENT_FUNDS',
                            message: `Yetersiz bakiye. Bu işlem için ${cost} coin gerekli.`,
                            required: cost,
                            tempId: tempId
                        });
                        return;
                    }

                    const updateRes = await client.query('UPDATE users SET balance = balance - $2 WHERE id = $1 RETURNING balance', [senderId, cost]);
                    userBalance = parseFloat(updateRes.rows[0].balance);
                    io.emit('admin_balance_update', { userId: senderId, newBalance: userBalance });
                    socket.emit('balance_update', { userId: senderId, newBalance: userBalance });

                    if (type === 'gift' && !isFemaleToFemale) {
                        const chatResInner = await client.query('SELECT operator_id FROM chats WHERE id = $1', [chatId]);
                        if (chatResInner.rows.length > 0) {
                            commissionDataToRunLater = { chatId, senderId: null, cost, type: 'gift' };
                        }
                    }
                } else {
                    // Free sender (Female to Male or Operator/Staff)
                    // If it is a female operator/staff responding to a male, she earns commission on response
                    // BUT only if she is NOT the "user" (customer/male) side of the chat, AND if the last message in chat was from the other user.
                    if (isFemaleSender && !isFemaleToFemale) {
                        let shouldGiveCommission = true;
                        if (chatReceiverId) {
                            const lastMsgRes = await client.query('SELECT sender_id FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 1', [chatId]);
                            if (lastMsgRes.rows.length > 0) {
                                const lastSenderId = lastMsgRes.rows[0].sender_id;
                                if (lastSenderId && lastSenderId.toString() !== chatReceiverId.toString()) {
                                    shouldGiveCommission = false;
                                    console.log(`[SOCKET] Commission denied for ${senderId} in chat ${chatId}: Last message was not from the user ${chatReceiverId}.`);
                                }
                            }
                        }

                        if (shouldGiveCommission) {
                            let commissionCost = 10;
                            if (type === 'image') commissionCost = 50;
                            else if (type === 'audio') commissionCost = 30;
                            
                            commissionDataToRunLater = { chatId, senderId, cost: commissionCost, type: type || 'text' };
                        }
                    }
                }

                console.log(`[SOCKET] Checking management status for role: ${socket.user.role}`);
                // --- 2. SENDER MAPPING (Zimmetleme & Management Check) ---
                let finalSenderId = senderId;
                
                // If sender is management, they should message AS the operator of this chat
                if (isManagement) {
                    if (chatRes.rows.length > 0) {
                        const avatarId = chatRes.rows[0].operator_id;
                        const chatUserId = chatRes.rows[0].user_id;
                        
                        // ONLY message as the avatar if the sender is NOT the customer (user_id) of the chat!
                        if (chatUserId && chatUserId.toString() !== senderId.toString()) {
                            // Zimmet Check: If it's a staff/moderator, check if they are allowed
                            if (socket.user.role === 'staff' || socket.user.role === 'moderator') {
                                const managerId = operatorManagedBy;
                                
                                if (managerId && managerId.toString() !== senderId.toString() && socket.user.role !== 'admin' && socket.user.role !== 'super_admin') {
                                    console.warn(`[SOCKET] Blocked unauthorized message attempt by ${senderId} for avatar ${avatarId}`);
                                    throw new Error('BU_PROFIL_SIZE_ZIMMETLI_DEGIL');
                                }
                            }
                            
                            // All management roles message AS the avatar to keep chat consistent
                            finalSenderId = avatarId;
                        }
                    }
                }

                // --- 3. SAVE MESSAGE ---
                const res = await client.query(
                    'INSERT INTO messages (chat_id, sender_id, content, content_type, gift_id, unlock_cost, is_unlocked, duration) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                    [chatId, finalSenderId, content, type || 'text', giftId || null, type === 'locked_image' ? (unlockCost || 200) : 0, type === 'locked_image' ? false : true, duration || null]
                );
                const savedMsg = res.rows[0];

                let lastMsgPreview = content;
                if (type === 'gift') lastMsgPreview = '🎁 Hediye Gönderildi';
                else if (type === 'image') lastMsgPreview = '📷 Resim';
                else if (type === 'locked_image') lastMsgPreview = '🔒 Kilitli Resim';
                else if (type === 'audio') lastMsgPreview = '🎤 Ses Kaydı';

                await client.query('UPDATE chats SET last_message_at = NOW(), last_message = $2 WHERE id = $1', [chatId, lastMsgPreview]);

                await client.query('COMMIT');

                // --- 3.5. EXECUTE COMMISSION LATER (SAFE ZONE) ---
                if (commissionDataToRunLater) {
                    try {
                        const updateInfo = await recordOperatorCommission(
                            client, 
                            commissionDataToRunLater.chatId, 
                            commissionDataToRunLater.senderId, 
                            commissionDataToRunLater.cost, 
                            commissionDataToRunLater.type
                        );
                        if (updateInfo) {
                            io.to(chatId.toString()).emit('message_updated', updateInfo);
                            console.log(`[SOCKET] Broadcasted message_updated to room ${chatId}:`, updateInfo);
                        }
                    } catch (commissionErr) {
                        console.error('[COMMISSION-SAFE] Commission failed but message was sent:', commissionErr.message);
                    }
                }

                // --- 4. EMIT EVENTS ---
                if (!isFreeSender) {
                    io.to(socket.id).emit('balance_update', { userId: senderId, newBalance: userBalance });
                }

                if (giftDetails) {
                    savedMsg.gift_name = giftDetails.name;
                    savedMsg.gift_cost = giftDetails.cost;
                    savedMsg.gift_icon = giftDetails.icon_url;
                }

                const msgToEmit = { 
                    ...savedMsg, 
                    chat_id: savedMsg.chat_id.toString(), 
                    type: savedMsg.content_type, // Alias for mobile app compatibility
                    tempId 
                };
                io.to(chatId.toString()).emit('receive_message', msgToEmit);
                
                // Notify recipient globally for unread badge updates
                try {
                    if (chatRes.rows.length > 0) {
                        const recipientId = finalSenderId.toString() === chatRes.rows[0].user_id.toString() 
                            ? chatRes.rows[0].operator_id 
                            : chatRes.rows[0].user_id;
                        io.to(recipientId.toString()).emit('new_message', msgToEmit);
                    }
                } catch (notifyErr) {
                    console.error('[SOCKET] Global notify error:', notifyErr.message);
                }
                
                io.emit('admin_notification', msgToEmit);

                // --- 5. PUSH NOTIFICATION (Non-blocking) ---
                (async () => {
                    try {
                        if (chatRes.rows.length > 0) {
                            const { user_id, operator_id } = chatRes.rows[0];
                            const recipientId = finalSenderId.toString() === user_id.toString() ? operator_id : user_id;

                            const senderRes = await client.query('SELECT display_name FROM users WHERE id = $1', [finalSenderId]);
                            const senderName = senderRes.rows[0]?.display_name || 'Bir kullanıcı';

                            await sendPushNotification(recipientId, {
                                title: `Yeni Mesaj: ${senderName}`,
                                body: type === 'text' ? content : (type === 'gift' ? '🎁 Sana bir hediye gönderdi!' : '📷 Bir medya dosyası gönderdi'),
                                data: { chatId: chatId.toString(), type: 'message' }
                            });
                        }
                    } catch (pushErr) {
                        console.error('[SOCKET] Push trigger error:', pushErr.message);
                    }
                })();

            } catch (err) {
                if (client) {
                    try { await client.query('ROLLBACK'); } catch (e) { console.error('[SOCKET] Rollback Error:', e.message); }
                }
                console.error('[SOCKET] CRITICAL Send Message Error:', err.message);
                console.error('[SOCKET] Error Stack:', err.stack);
                console.error('[SOCKET] Failed Message Data:', JSON.stringify({ chatId, senderId, type, tempId }));
                
                if (!global.payoutLogs) global.payoutLogs = [];
                global.payoutLogs.push({ timestamp: new Date().toISOString(), type: 'SEND_ERROR', error: err.message, stack: err.stack });
                
                let errorMsg = (err.message === 'BU_PROFIL_SIZE_ZIMMETLI_DEGIL') 
                    ? 'Bu profil size zimmetli değil.' 
                    : 'Mesaj gönderilemedi.';
                
                errorMsg += ` (${err.message})`;

                io.to(socket.id).emit('message_error', {
                    code: err.message === 'BU_PROFIL_SIZE_ZIMMETLI_DEGIL' ? 'UNAUTHORIZED' : 'SEND_FAILED',
                    message: errorMsg,
                    debug: err.message
                });
            } finally {
                if (client) {
                    client.release();
                }
            }
        });

        socket.on('message_reaction', async (data) => {
            const { messageId, reaction, chatId } = data;
            try {
                await db.query('UPDATE messages SET reaction = $1 WHERE id = $2', [reaction, messageId]);
                io.to(chatId.toString()).emit('message_reaction', { messageId, reaction, chatId });
            } catch (err) {
                console.error('[SOCKET] reaction error:', err.message);
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });
}

module.exports = { initializeSockets };
