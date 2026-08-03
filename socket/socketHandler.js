const db = require('../db');
const { recordOperatorCommission } = require('../utils/commissionUtils');
const { sendPushNotification } = require('../utils/notificationUtils');

function pushPayoutLog(entry) {
    if (!global.payoutLogs) global.payoutLogs = [];
    global.payoutLogs.push(entry);
    if (global.payoutLogs.length > 500) {
        global.payoutLogs.shift();
    }
}

// ─── Call Sessions & Billing Management ──────────────────────────────────
const activeCallSessions = new Map(); // Key: chatId, Value: { callId, callerId, receiverId, status, startedAt, acceptedAt, endedAt, billingIntervalId }

function isUserInAnyActiveCall(userId, excludeChatId = null) {
    if (!userId) return false;
    const uIdStr = userId.toString();
    const exclStr = excludeChatId ? excludeChatId.toString() : null;
    const now = Date.now();
    for (const [key, session] of activeCallSessions.entries()) {
        if (!session) {
            activeCallSessions.delete(key);
            continue;
        }
        if (exclStr && key.toString() === exclStr) {
            continue;
        }
        // Auto-cleanup stale sessions older than 30s that are still in ringing state
        if (session.status === 'ringing' && session.startedAt && (now - new Date(session.startedAt).getTime() > 30000)) {
            console.log(`[CALL CLEANUP 🧹] Auto-purged stale ringing session for key ${key}`);
            if (session.connectionTimeoutId) clearTimeout(session.connectionTimeoutId);
            activeCallSessions.delete(key);
            continue;
        }
        if (session.status !== 'ended' && (session.callerId?.toString() === uIdStr || session.receiverId?.toString() === uIdStr)) {
            return true;
        }
    }
    return false;
}

async function chargeCallMinute(io, chatId, callerId, receiverId) {
    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');

        const callerRes = await client.query('SELECT balance, role, gender FROM users WHERE id = $1 FOR UPDATE', [callerId]);
        const receiverRes = await client.query('SELECT balance, role, gender FROM users WHERE id = $1 FOR UPDATE', [receiverId]);
        if (callerRes.rows.length === 0 || receiverRes.rows.length === 0) throw new Error('Call participants not found');

        const caller = callerRes.rows[0];
        const receiver = receiverRes.rows[0];

        const callerGender = (caller.gender || '').toLowerCase();
        const receiverGender = (receiver.gender || '').toLowerCase();

        const callerIsMale = callerGender === 'erkek';
        const receiverIsMale = receiverGender === 'erkek';

        const isCallerManagement = ['admin', 'super_admin', 'moderator', 'staff', 'operator'].includes(caller.role);
        const isReceiverManagement = ['admin', 'super_admin', 'moderator', 'staff', 'operator'].includes(receiver.role);

        const session = activeCallSessions.get(chatId);
        const callType = session ? (session.callType || 'audio') : 'audio';
        const costPerMinute = callType === 'video' ? 120 : 50;

        // Rules:
        // 1. Kadın users NEVER pay coins.
        // 2. Male calling Female: Only Male caller pays.
        // 3. Female calling Male: Only Male receiver pays.
        // 4. Male calling Male: BOTH Male participants pay.
        const shouldChargeCaller = callerIsMale && !isCallerManagement;
        const shouldChargeReceiver = receiverIsMale && !isReceiverManagement;

        let callerBalance = parseFloat(caller.balance || 0);
        let receiverBalance = parseFloat(receiver.balance || 0);

        // Pre-check balances
        if (shouldChargeCaller && callerBalance < costPerMinute) {
            console.log(`[CALL BILLING] Insufficient balance for male caller ${callerId} (${callerBalance} < ${costPerMinute}).`);
            await client.query('ROLLBACK');
            return { success: false, reason: 'insufficient_funds' };
        }

        if (shouldChargeReceiver && receiverBalance < costPerMinute) {
            console.log(`[CALL BILLING] Insufficient balance for male receiver ${receiverId} (${receiverBalance} < ${costPerMinute}).`);
            await client.query('ROLLBACK');
            return { success: false, reason: 'insufficient_funds' };
        }

        // Deduct from caller if applicable
        if (shouldChargeCaller) {
            const updRes = await client.query('UPDATE users SET balance = balance - $2 WHERE id = $1 RETURNING balance', [callerId, costPerMinute]);
            callerBalance = parseFloat(updRes.rows[0].balance);
            io.emit('admin_balance_update', { userId: callerId, newBalance: callerBalance });
            io.to(callerId.toString()).emit('balance_update', { userId: callerId, newBalance: callerBalance });
            console.log(`[CALL BILLING 💰] Deducted ${costPerMinute} coins from male caller ${callerId}. New balance: ${callerBalance}`);
        }

        // Deduct from receiver if applicable
        if (shouldChargeReceiver) {
            const updRes = await client.query('UPDATE users SET balance = balance - $2 WHERE id = $1 RETURNING balance', [receiverId, costPerMinute]);
            receiverBalance = parseFloat(updRes.rows[0].balance);
            io.emit('admin_balance_update', { userId: receiverId, newBalance: receiverBalance });
            io.to(receiverId.toString()).emit('balance_update', { userId: receiverId, newBalance: receiverBalance });
            console.log(`[CALL BILLING 💰] Deducted ${costPerMinute} coins from male receiver ${receiverId}. New balance: ${receiverBalance}`);
        }

        await client.query('COMMIT');

        // Record operator commission if female is an operator
        if (!callerIsMale || !receiverIsMale) {
            let commClient;
            try {
                commClient = await db.pool.connect();
                await commClient.query('BEGIN');
                const callId = session ? session.callId : null;
                const femaleId = !callerIsMale ? callerId : receiverId;
                const commissionInfo = await recordOperatorCommission(commClient, chatId, femaleId, costPerMinute, callType === 'video' ? 'video' : 'audio', callId);
                await commClient.query('COMMIT');
                if (commissionInfo) {
                    io.to(chatId.toString()).emit('message_updated', commissionInfo);
                }
            } catch (commErr) {
                if (commClient) await commClient.query('ROLLBACK');
                console.error('[CALL BILLING] Commission record failed:', commErr.message);
            } finally {
                if (commClient) commClient.release();
            }
        }

        return { success: true, callerBalance, receiverBalance };
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('[CALL BILLING] Error charging minute:', err.message);
        return { success: false, reason: 'error', message: err.message };
    } finally {
        if (client) client.release();
    }
}

async function startCallBilling(io, chatId, callerId, receiverId) {
    const session = activeCallSessions.get(chatId);
    if (!session) return;

    // Check caller balance right away and emit low balance warning if under 2 minutes
    const checkLowBalance = async () => {
        try {
            const cost = session.callType === 'video' ? 120 : 50;
            const res = await db.query('SELECT balance FROM users WHERE id::text = $1::text', [callerId]);
            if (res.rows.length > 0) {
                const bal = parseFloat(res.rows[0].balance || 0);
                if (bal < cost * 2) {
                    const remainingMins = Math.max(1, Math.floor(bal / cost));
                    io.to(callerId.toString()).emit('low_balance_warning', {
                        chatId,
                        currentBalance: bal,
                        costPerMinute: cost,
                        remainingMinutes: remainingMins,
                        message: `Bakiyeniz ${remainingMins} dakikadan az kaldı! Görüşmenin kesilmemesi için bakiye yükleyin.`
                    });
                }
            }
        } catch (e) {}
    };

    checkLowBalance();

    // Runs at t = 60s, 120s, 180s...
    const billingIntervalId = setInterval(async () => {
        console.log(`[CALL BILLING] Ticking charge for chat ${chatId}...`);
        const chargeRes = await chargeCallMinute(io, chatId, callerId, receiverId);
        if (!chargeRes.success) {
            console.log(`[CALL BILLING] Insufficient balance on tick for caller ${callerId}. Ending call.`);
            await endCallSession(io, chatId, 'insufficient_funds');
        } else {
            checkLowBalance();
        }
    }, 60000); // Charged every 60 seconds

    session.billingIntervalId = billingIntervalId;
}

async function refundFirstMinute(io, callerId, receiverId, chatId, callId, callType = 'audio') {
    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');

        const costPerMinute = callType === 'video' ? 120 : 50;

        // Verify if caller is free caller (no need to refund if no coin was deducted)
        const userRes = await client.query('SELECT role, gender FROM users WHERE id = $1', [callerId]);
        const userRole = userRes.rows[0]?.role;
        const callerGender = (userRes.rows[0]?.gender || '').toLowerCase();
        const isManagement = ['admin', 'super_admin', 'moderator', 'staff', 'operator'].includes(userRole);
        const isFreeCaller = isManagement || callerGender === 'kadin';

        if (!isFreeCaller) {
            // Unique Check: verify if refund has already been recorded for this callId
            if (callId) {
                const refundCheck = await client.query(
                    "SELECT 1 FROM commission_logs WHERE call_id = $1 AND type = 'refund'",
                    [callId]
                );
                if (refundCheck.rows.length > 0) {
                    console.log(`[CALL REFUND] Already refunded for callId ${callId}. Bypassing duplicate refund.`);
                    await client.query('COMMIT');
                    return;
                }
            }

            // Refund User A (Caller)
            await client.query('UPDATE users SET balance = balance + $2 WHERE id = $1', [callerId, costPerMinute]);
            
            // Fetch fresh balance to emit
            const freshRes = await client.query('SELECT balance FROM users WHERE id = $1', [callerId]);
            const newBalance = parseFloat(freshRes.rows[0].balance);

            // Emit balance updates to users
            io.emit('admin_balance_update', { userId: callerId, newBalance });
            io.to(callerId.toString()).emit('balance_update', { userId: callerId, newBalance });

            // Fetch the original commission log to reverse
            let earnedAmount = 0;
            let agencyId = null;

            if (callId) {
                const commRes = await client.query(
                    `SELECT amount, agency_id FROM commission_logs 
                     WHERE call_id = $1 AND type = 'call'
                     ORDER BY created_at DESC LIMIT 1`,
                    [callId]
                );

                if (commRes.rows.length > 0) {
                    earnedAmount = parseFloat(commRes.rows[0].amount);
                    agencyId = commRes.rows[0].agency_id;
                }
            }

            if (earnedAmount > 0) {
                // Insert negative reversal log entry
                const refundEarned = -earnedAmount;
                await client.query(
                    "INSERT INTO commission_logs (operator_id, chat_id, amount, type, agency_id, call_id) VALUES ($1, $2, $3, 'refund', $4, $5)",
                    [receiverId, chatId, refundEarned, agencyId, callId]
                );

                // Update operator pending balance and lifetime earnings
                await client.query(
                    `UPDATE operators SET 
                        pending_balance = GREATEST(0, COALESCE(pending_balance, 0) - $1), 
                        lifetime_earnings = GREATEST(0, COALESCE(lifetime_earnings, 0) - $1) 
                     WHERE user_id = $2`,
                    [earnedAmount, receiverId]
                );

                // Reverse agency balance if applicable
                if (agencyId) {
                    const agencyRate = 0.40;
                    const agencyRefund = earnedAmount * agencyRate;
                    await client.query(
                        `UPDATE agencies SET 
                            pending_balance = GREATEST(0, COALESCE(pending_balance, 0) - $1), 
                            lifetime_earnings = GREATEST(0, COALESCE(lifetime_earnings, 0) - $1) 
                         WHERE id = $2`,
                        [agencyRefund, agencyId]
                    );
                }

                // Update daily stats (reduce coins_earned)
                await client.query(
                    `UPDATE operator_stats SET 
                        coins_earned = GREATEST(0, COALESCE(coins_earned, 0) - $1),
                        total_user_spend = GREATEST(0, COALESCE(total_user_spend, 0) - $2)
                     WHERE operator_id::text = $3::text AND date = CURRENT_DATE`,
                    [earnedAmount, costPerMinute, receiverId]
                );
            }
        }

        await client.query('COMMIT');
        console.log(`[CALL REFUND] Successfully refunded ${costPerMinute} coins to caller ${callerId} for callId ${callId}.`);
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('[CALL REFUND] Refund failed:', err.message);
    } finally {
        if (client) client.release();
    }
}

async function handleConnectionFailure(io, chatId) {
    const session = activeCallSessions.get(chatId);
    if (!session || session.status === 'ended') return;

    const callType = session.callType || 'audio';
    session.status = 'ended';
    if (session.connectionTimeoutId) {
        clearTimeout(session.connectionTimeoutId);
    }

    activeCallSessions.delete(chatId);

    // Refund the caller
    await refundFirstMinute(io, session.callerId, session.receiverId, chatId, session.callId, callType);

    // Log missed call stub in database
    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');
        const stubContent = JSON.stringify({
            duration: '0:00',
            durationSeconds: 0,
            reason: 'connection_failed',
            status: 'connection_failed',
            callType,
            started_at: session.startedAt,
            ended_at: new Date(),
            call_id: session.callId
        });
        const messageRes = await client.query(`
            INSERT INTO messages (chat_id, sender_id, content, content_type, is_unlocked)
            VALUES ($1, $2, $3, 'call_stub', true)
            RETURNING *
        `, [chatId, session.callerId, stubContent]);

        const savedMsg = messageRes.rows[0];
        const label = callType === 'video' ? 'Görüntülü Bağlantı Kurulamadı' : 'Bağlantı Kurulamadı';
        await client.query("UPDATE chats SET last_message_at = NOW(), last_message = $2 WHERE id = $1", [chatId, `📞 ${label}`]);
        await client.query('COMMIT');

        io.to(chatId.toString()).emit('call_ended', { chatId, reason: 'connection_failed', message: savedMsg });
        io.to(session.callerId.toString()).emit('new_message', { ...savedMsg, type: 'call_stub' });
        io.to(session.receiverId.toString()).emit('new_message', { ...savedMsg, type: 'call_stub' });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('[CONNECTION FAILURE CLEANUP] Error:', err.message);
    } finally {
        if (client) client.release();
    }
}

async function endCallSession(io, chatId, reason) {
    const session = activeCallSessions.get(chatId);
    if (!session || session.status === 'ended') return;

    const callType = session.callType || 'audio';

    if (session.connectionTimeoutId) {
        clearTimeout(session.connectionTimeoutId);
        session.connectionTimeoutId = null;
    }

    if (session.status === 'paid_pending_connection') {
        await refundFirstMinute(io, session.callerId, session.receiverId, chatId, session.callId, callType);
    }

    session.status = 'ended';
    session.endedAt = new Date();

    if (session.billingIntervalId) {
        clearInterval(session.billingIntervalId);
    }

    activeCallSessions.delete(chatId);

    const acceptedTime = session.acceptedAt || session.startedAt;
    const durationMs = session.endedAt - acceptedTime;
    const durationSeconds = Math.round(durationMs / 1000);

    const mins = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

    console.log(`[CALL SESSION END] ChatId: ${chatId}. Reason: ${reason}. Duration: ${durationStr} (Type: ${callType})`);

    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');

        const stubContent = JSON.stringify({
            duration: durationStr,
            durationSeconds,
            reason,
            callType,
            status: reason === 'insufficient_funds' ? 'insufficient_funds' : 'ended',
            started_at: session.startedAt,
            accepted_at: session.acceptedAt,
            ended_at: session.endedAt,
            call_id: session.callId
        });

        const messageRes = await client.query(`
            INSERT INTO messages (chat_id, sender_id, content, content_type, is_unlocked)
            VALUES ($1, $2, $3, 'call_stub', true)
            RETURNING *
        `, [chatId, session.callerId, stubContent]);

        const savedMsg = messageRes.rows[0];

        const lastMsgPreview = callType === 'video' ? `🎥 Görüntülü Arama Sonlandı (${durationStr})` : `📞 Sesli Arama Sonlandı (${durationStr})`;

        await client.query('UPDATE chats SET last_message_at = NOW(), last_message = $2 WHERE id = $1', [chatId, lastMsgPreview]);
        await client.query('COMMIT');

        console.log(`[CALL LOG 🟢] Saved call stub msgId=${savedMsg.id}, duration=${durationStr}`);

        // Broadcast to chat room in real-time so ChatScreen updates instantly
        io.to(chatId.toString()).emit('receive_message', savedMsg);
        io.to(chatId.toString()).emit('new_message', savedMsg);
        io.to(chatId.toString()).emit('call_ended', {
            chatId: chatId.toString(),
            reason,
            duration: durationStr,
            message: savedMsg
        });

        io.to(session.callerId.toString()).emit('new_message', { ...savedMsg, type: 'call_stub' });
        io.to(session.receiverId.toString()).emit('new_message', { ...savedMsg, type: 'call_stub' });

    } catch (dbErr) {
        if (client) await client.query('ROLLBACK');
        console.error('[CALL SESSION END] Failed to save call stub message:', dbErr.message);
        io.to(chatId.toString()).emit('call_ended', { chatId, reason, duration: durationStr });
    } finally {
        if (client) client.release();
    }
}

async function logMissedCall(io, chatId, callerId, receiverId, status) {
    const session = activeCallSessions.get(chatId);
    if (!session || session.status === 'ended') return;

    const callType = session.callType || 'audio';

    if (session.connectionTimeoutId) {
        clearTimeout(session.connectionTimeoutId);
        session.connectionTimeoutId = null;
    }

    if (session.status === 'paid_pending_connection') {
        await refundFirstMinute(io, session.callerId, session.receiverId, chatId, session.callId, callType);
    }

    session.status = 'ended';
    session.endedAt = new Date();

    activeCallSessions.delete(chatId);

    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');

        const stubContent = JSON.stringify({
            duration: '0:00',
            durationSeconds: 0,
            reason: status,
            callType,
            status,
            started_at: session.startedAt,
            ended_at: session.endedAt,
            call_id: session.callId
        });

        const messageRes = await client.query(`
            INSERT INTO messages (chat_id, sender_id, content, content_type, is_unlocked)
            VALUES ($1, $2, $3, 'call_stub', true)
            RETURNING *
        `, [chatId, callerId, stubContent]);

        const savedMsg = messageRes.rows[0];

        const icon = callType === 'video' ? '🎥' : '📞';
        const label = callType === 'video' ? 'Görüntülü Arama' : 'Sesli Arama';
        let lastMsgPreview = `${icon} Cevapsız ${label}`;
        if (status === 'rejected') lastMsgPreview = `${icon} ${label} Reddedildi`;
        else if (status === 'cancelled') lastMsgPreview = `${icon} İptal Edilen ${label}`;
        else if (status === 'busy') lastMsgPreview = `${icon} ${label} Meşgul`;

        await client.query('UPDATE chats SET last_message_at = NOW(), last_message = $2 WHERE id = $1', [chatId, lastMsgPreview]);
        await client.query('COMMIT');

        io.to(chatId.toString()).emit('call_ended', { chatId, reason: status, message: savedMsg });

        io.to(callerId.toString()).emit('new_message', { ...savedMsg, type: 'call_stub' });
        io.to(receiverId.toString()).emit('new_message', { ...savedMsg, type: 'call_stub' });

    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('[LOG MISSED CALL] Error:', err.message);
    } finally {
        if (client) client.release();
    }
}

function initializeSockets(io) {
    io.on('connection', (socket) => {
        const connLog = {
            timestamp: new Date().toISOString(),
            type: 'CLIENT_CONNECTED',
            socketId: socket.id,
            user: socket.user ? { id: socket.user.id, username: socket.user.username } : 'ANONYMOUS'
        };
        pushPayoutLog(connLog);
        
        console.log(`[SOCKET] User connected: ${socket.id} (Authenticated: ${socket.user ? socket.user.username : 'NO'})`);

        // Join their own room for global notifications
        const effectiveUserId = socket.user?.id || socket.handshake?.query?.userId || socket.handshake?.auth?.userId;
        if (effectiveUserId) {
            const userRoom = effectiveUserId.toString();
            socket.join(userRoom);
            console.log(`[SOCKET] User ${socket.user?.username || effectiveUserId} joined personal room: ${userRoom}`);
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

            // ATOMIC SYNC DEDUPLICATION
            if (!global.processedTempIds) global.processedTempIds = new Set();
            const dedupeKey = tempId || `${chatId}_${senderId}_${content}`;
            
            if (global.processedTempIds.has(dedupeKey)) {
                console.warn(`[SOCKET] Blocked synchronous duplicate message for key: ${dedupeKey}`);
                return; // Stop immediately without hitting DB
            }
            global.processedTempIds.add(dedupeKey);
            setTimeout(() => global.processedTempIds.delete(dedupeKey), 5000); // Clear after 5s

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

                // Award Family XP if this is a gift
                if (type === 'gift' && giftDetails) {
                    try {
                        const { handleGiftFamilyXp } = require('../utils/familyXpUtils');
                        await handleGiftFamilyXp(client, senderId, chatReceiverId, giftDetails.cost);
                    } catch (xpErr) {
                        console.error('[FamilyXP-DM] Failed to award family XP:', xpErr.message);
                    }
                }

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

                // Fetch active nobility details of finalSenderId
                const senderNobilityRes = await client.query(`
                    SELECT un.expires_at as nobility_expires_at, 
                           nt.key as nobility_key, 
                           nt.name as nobility_name, 
                           nt.level as nobility_level, 
                           nt.badge_url as nobility_badge_url, 
                           nt.name_color as nobility_name_color
                    FROM user_nobility un
                    JOIN nobility_titles nt ON un.title_id = nt.id
                    WHERE un.user_id = $1 AND un.is_active = TRUE AND un.expires_at > NOW()
                    ORDER BY nt.priority_weight DESC LIMIT 1
                `, [finalSenderId.toString()]);
                const senderNobility = senderNobilityRes.rows[0] || {};

                const msgToEmit = { 
                    ...savedMsg, 
                    chat_id: savedMsg.chat_id.toString(), 
                    type: savedMsg.content_type, // Alias for mobile app compatibility
                    tempId,
                    nobility_key: senderNobility.nobility_key || null,
                    nobility_name: senderNobility.nobility_name || null,
                    nobility_level: senderNobility.nobility_level || null,
                    nobility_badge_url: senderNobility.nobility_badge_url || null,
                    nobility_name_color: senderNobility.nobility_name_color || null
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

        // ─── 1-to-1 Voice Call Socket Handlers ────────────────────────────────
        socket.on('call_request', async (data) => {
            const { chatId: rawChatId, receiverId, callerName, callerAvatar, rtcToken, channelName, callId, callType } = data;
            const callerId = socket.user ? socket.user.id : (socket.handshake?.query?.userId || socket.handshake?.auth?.userId);
            const type = callType === 'video' ? 'video' : 'audio';
            const cost = type === 'video' ? 120 : 50;

            console.log(`[CALL LOG 📞] call_request received: callerId=${callerId}, receiverId=${receiverId}, rawChatId=${rawChatId}, type=${type}`);

            try {
                if (!callerId || !receiverId) {
                    console.log(`[CALL LOG ❌] call_request rejected: Missing user info. callerId=${callerId}, receiverId=${receiverId}`);
                    socket.emit('call_error', { message: 'Arama başlatılamadı: Kullanıcı bilgisi eksik.' });
                    return;
                }

                let chatId = rawChatId;
                if (!chatId) {
                    const existingChat = await db.query(
                        'SELECT id FROM chats WHERE (user_id = $1 AND operator_id = $2) OR (user_id = $2 AND operator_id = $1)',
                        [callerId, receiverId]
                    );
                    if (existingChat.rows.length > 0) {
                        chatId = existingChat.rows[0].id;
                    } else {
                        const newChat = await db.query(
                            'INSERT INTO chats (user_id, operator_id, created_at, last_message_at, last_message) VALUES ($1, $2, NOW(), NOW(), $3) RETURNING id',
                            [callerId, receiverId, '📞 Arama Başlatıldı']
                        );
                        chatId = newChat.rows[0].id;
                    }
                }

                // Security Check: verify caller and receiver belong to this chat
                const chatRes = await db.query(
                    'SELECT user_id, operator_id FROM chats WHERE id = $1',
                    [chatId]
                );
                if (chatRes.rows.length === 0) {
                    console.log(`[CALL LOG ❌] Chat not found for chatId=${chatId}`);
                    socket.emit('call_error', { message: 'Sohbet bulunamadı.' });
                    return;
                }
                const chat = chatRes.rows[0];
                const isCallerMember = chat.user_id.toString() === callerId.toString() || chat.operator_id.toString() === callerId.toString();
                const isReceiverMember = chat.user_id.toString() === receiverId.toString() || chat.operator_id.toString() === receiverId.toString();

                if (!isCallerMember || !isReceiverMember) {
                    console.log(`[CALL LOG ❌] Chat membership verification failed for callerId=${callerId}, receiverId=${receiverId}`);
                    socket.emit('call_error', { message: 'Sohbet üyeliği doğrulanamadı.' });
                    return;
                }

                // Busy Check: check if caller or receiver is currently in ANOTHER call
                if (isUserInAnyActiveCall(callerId, chatId)) {
                    console.log(`[CALL LOG ⚠️] Caller ${callerId} is already in an active call in another chat.`);
                    socket.emit('call_error', { message: 'Zaten başka bir aktif aramadasınız.' });
                    return;
                }
                if (isUserInAnyActiveCall(receiverId, chatId)) {
                    console.log(`[CALL LOG ⚠️] Receiver ${receiverId} is currently busy in another call.`);
                    socket.emit('call_error', { message: 'Aradığınız kişi başka bir görüşmede (meşgul).' });
                    socket.emit('call_busy', { chatId });
                    return;
                }

                // If a stale ringing session exists for this same chat, clean it up before starting new call
                const existingSession = activeCallSessions.get(chatId.toString());
                if (existingSession) {
                    console.log(`[CALL LOG 🧹] Clearing previous stale session for chatId=${chatId}`);
                    if (existingSession.connectionTimeoutId) clearTimeout(existingSession.connectionTimeoutId);
                    if (existingSession.billingIntervalId) clearInterval(existingSession.billingIntervalId);
                    activeCallSessions.delete(chatId.toString());
                }

                // Balance check
                const userRes = await db.query('SELECT balance, role, display_name FROM users WHERE id = $1', [callerId]);
                if (userRes.rows.length === 0) throw new Error('Caller not found');

                const balance = parseFloat(userRes.rows[0].balance || 0);
                const userRole = userRes.rows[0].role;
                const dbCallerName = userRes.rows[0].display_name || callerName || 'Bir kullanıcı';
                const isManagement = ['admin', 'super_admin', 'moderator', 'staff', 'operator'].includes(userRole);

                const callerGenderRes = await db.query('SELECT gender FROM users WHERE id = $1', [callerId]);
                const callerGender = (callerGenderRes.rows[0]?.gender || '').toLowerCase();
                const isFreeCaller = isManagement || callerGender === 'kadin';

                if (!isFreeCaller && balance < cost) {
                    console.log(`[CALL LOG 💰] Insufficient balance for caller ${callerId}. Balance: ${balance}, Cost: ${cost}`);
                    socket.emit('call_error', { message: `Yetersiz bakiye. Arama başlatmak için en az ${cost} coin gereklidir.` });
                    return;
                }

                const finalCallId = callId || `call_${Date.now()}_${Math.random().toString(36).substring(7)}`;

                // Create 30-second ringing timeout
                const ringTimeoutId = setTimeout(async () => {
                    console.log(`[CALL LOG ⏰] 30s Ringing timeout expired for chatId=${chatId}. Marking as missed call.`);
                    await logMissedCall(io, chatId.toString(), callerId, receiverId, 'missed');
                }, 30000);

                // Create the call session in map
                activeCallSessions.set(chatId.toString(), {
                    callId: finalCallId,
                    callerId,
                    receiverId,
                    status: 'ringing',
                    callType: type,
                    startedAt: new Date(),
                    acceptedAt: null,
                    endedAt: null,
                    connectionTimeoutId: ringTimeoutId,
                    billingIntervalId: null
                });

                const callPayload = {
                    chatId: chatId.toString(),
                    callerId: callerId.toString(),
                    receiverId: receiverId.toString(),
                    callerName: dbCallerName,
                    callerAvatar,
                    rtcToken,
                    channelName,
                    callId: finalCallId,
                    callType: type
                };

                console.log(`[CALL LOG 🔔] Emitting incoming_call payload to receiver ${receiverId} (room: ${receiverId.toString()}):`, callPayload);

                // Emit incoming_call event ONCE strictly to receiver's personal socket room
                io.to(receiverId.toString()).emit('incoming_call', callPayload);

                socket.emit('call_ringing', { chatId, receiverId });

                // Trigger Push Notification for incoming call (Non-blocking)
                (async () => {
                    try {
                        const { sendPushNotification } = require('../utils/pushNotifications');
                        await sendPushNotification(receiverId, {
                            title: `📞 Gelen ${type === 'video' ? 'Görüntülü' : 'Sesli'} Arama`,
                            body: `${dbCallerName} seni arıyor...`,
                            data: {
                                type: 'incoming_call',
                                chatId: chatId.toString(),
                                callerId: callerId.toString(),
                                callType: type,
                                callId: finalCallId
                            }
                        });
                        console.log(`[CALL LOG 📲] Push notification sent successfully to receiver ${receiverId}`);
                    } catch (pushErr) {
                        console.error('[CALL LOG ⚠️] Call push notification error:', pushErr.message);
                    }
                })();

            } catch (err) {
                console.error('[CALL LOG 💥] call_request critical error:', err.message);
                socket.emit('call_error', { message: 'Arama başlatılamadı.' });
            }
        });

        socket.on('call_accept', async (data) => {
            const { chatId, callerId } = data;
            const receiverId = socket.user?.id || (socket.handshake?.query?.userId || socket.handshake?.auth?.userId);
            const roomKey = chatId ? chatId.toString() : '';

            console.log(`[CALL LOG 🟢] call_accept received from receiverId=${receiverId} for caller ${callerId} in chat ${roomKey}`);

            const session = activeCallSessions.get(roomKey);
            if (!session || session.status !== 'ringing') {
                console.log(`[CALL LOG ⚠️] call_accept ignored: no active ringing session found for key '${roomKey}'.`);
                return;
            }

            // Clear the 30s ringing timeout
            if (session.connectionTimeoutId) {
                clearTimeout(session.connectionTimeoutId);
                session.connectionTimeoutId = null;
                console.log(`[CALL LOG 🟢] Cleared 30s ringing timeout for chat ${roomKey}`);
            }

            session.status = 'accepted_waiting_media';
            session.acceptedAt = new Date();

            // Set 15s Media Connection Guard Timeout (If RTC media fails to connect within 15s, cancel without charging)
            session.connectionTimeoutId = setTimeout(async () => {
                console.log(`[CALL BILLING GUARD ⚠️] 15s Media connection timeout for chat ${roomKey}. Cancelling call with zero charges.`);
                await logMissedCall(io, roomKey, callerId, receiverId, 'connection_failed');
            }, 15000);

            // Only notify the CALLER that receiver accepted - receiver already knows (they pressed accept)
            io.to(callerId.toString()).emit('call_started', { chatId: roomKey });
        });

        socket.on('call_connected', async (data) => {
            const { chatId } = data;
            const roomKey = chatId ? chatId.toString() : '';
            console.log(`[CALL LOG 🟢] call_connected received for chat ${roomKey}. Broadcasting call_connected to room.`);

            const session = activeCallSessions.get(roomKey);
            if (session && (session.status === 'accepted_waiting_media' || session.status === 'ringing')) {
                // Clear 15s media connection guard timeout
                if (session.connectionTimeoutId) {
                    clearTimeout(session.connectionTimeoutId);
                    session.connectionTimeoutId = null;
                    console.log(`[CALL BILLING GUARD 🟢] Media connected! Cleared 15s media timeout for chat ${roomKey}`);
                }

                // Charge first minute upfront now that media is verified
                console.log(`[CALL BILLING GUARD 💰] Charging first minute upfront for caller ${session.callerId}...`);
                const firstMinuteCharged = await chargeCallMinute(io, roomKey, session.callerId, session.receiverId);
                if (!firstMinuteCharged.success) {
                    console.log(`[CALL ACCEPT] First minute charge failed for caller ${session.callerId}. Rejecting call.`);
                    session.status = 'ended';
                    activeCallSessions.delete(roomKey);

                    socket.emit('call_error', { message: 'Arama başlatılamadı. Arayanın bakiyesi yetersiz.' });
                    io.to(session.callerId.toString()).emit('call_error', { message: 'Yetersiz bakiye. Arama sonlandırıldı.' });
                    io.to(session.callerId.toString()).emit('call_ended', { chatId: roomKey, reason: 'insufficient_funds' });
                    socket.emit('call_ended', { chatId: roomKey, reason: 'insufficient_funds' });
                    return;
                }

                session.status = 'active';
                await startCallBilling(io, roomKey, session.callerId, session.receiverId);
            }

            io.to(roomKey).emit('call_connected', { chatId: roomKey });
        });

        socket.on('call_reject', async (data) => {
            const { chatId, callerId } = data;
            const receiverId = socket.user?.id || (socket.handshake?.query?.userId || socket.handshake?.auth?.userId);
            const roomKey = chatId ? chatId.toString() : '';
            console.log(`[CALL LOG ❌] call_reject by ${receiverId} for caller ${callerId} in chat ${roomKey}`);

            const session = activeCallSessions.get(roomKey);
            if (!session || session.status !== 'ringing') return;

            await logMissedCall(io, roomKey, callerId, receiverId, 'rejected');
        });

        socket.on('call_cancel', async (data) => {
            const { chatId, receiverId } = data;
            const callerId = socket.user?.id || (socket.handshake?.query?.userId || socket.handshake?.auth?.userId);
            const roomKey = chatId ? chatId.toString() : '';
            console.log(`[CALL LOG ⏹️] call_cancel by ${callerId} for receiver ${receiverId} in chat ${roomKey}`);

            const session = activeCallSessions.get(roomKey);
            if (!session || session.status !== 'ringing') return;

            await logMissedCall(io, roomKey, callerId, receiverId, 'cancelled');
        });

        socket.on('call_busy', async (data) => {
            const { chatId, callerId } = data;
            const receiverId = socket.user?.id || (socket.handshake?.query?.userId || socket.handshake?.auth?.userId);
            const roomKey = chatId ? chatId.toString() : '';
            console.log(`[CALL LOG 🚫] call_busy by ${receiverId} for caller ${callerId} in chat ${roomKey}`);

            const session = activeCallSessions.get(roomKey);
            if (!session || session.status !== 'ringing') return;

            await logMissedCall(io, roomKey, callerId, receiverId, 'busy');
        });

        socket.on('call_end', async (data) => {
            const { chatId } = data;
            const roomKey = chatId ? chatId.toString() : '';
            console.log(`[CALL LOG 🔴] call_end received for chat ${roomKey}`);

            const session = activeCallSessions.get(roomKey);
            if (!session) return;

            if (session.status === 'ringing') {
                await logMissedCall(io, roomKey, session.callerId, session.receiverId, 'cancelled');
            } else if (session.status === 'active') {
                await endCallSession(io, roomKey, 'ended');
            }
        });

        socket.on('force_clear_call', () => {
            const userId = socket.user?.id || (socket.handshake?.query?.userId || socket.handshake?.auth?.userId);
            if (!userId) return;
            const uIdStr = userId.toString();
            for (const [chatId, session] of activeCallSessions.entries()) {
                if (session.callerId?.toString() === uIdStr || session.receiverId?.toString() === uIdStr) {
                    console.log(`[CALL CLEANUP 🧹] Force clearing active call session for user ${userId} in chat ${chatId}`);
                    if (session.connectionTimeoutId) clearTimeout(session.connectionTimeoutId);
                    if (session.billingIntervalId) clearInterval(session.billingIntervalId);
                    activeCallSessions.delete(chatId);
                }
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            if (socket.user && socket.user.id) {
                const userId = socket.user.id.toString();
                for (const [chatId, session] of activeCallSessions.entries()) {
                    if (session.callerId.toString() === userId || session.receiverId.toString() === userId) {
                        if (session.status === 'ringing') {
                            logMissedCall(io, chatId, session.callerId, session.receiverId, 'cancelled');
                        } else if (session.status === 'active') {
                            endCallSession(io, chatId, 'disconnected');
                        }
                    }
                }
            }
        });
    });
}

module.exports = { initializeSockets };

