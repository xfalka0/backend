const db = require('../db');

const inMemoryPartyIdempotencyKeys = new Set();
const pendingPartyIdempotencyKeys = new Set();

function handlePartyRoomSockets(io, socket) {
    // 1. JOIN PARTY ROOM
    socket.on('join_party_room', async (data) => {
        const { roomId } = data;
        if (!roomId) return;

        // Track voice stay time for previous room if switching
        if (socket.user && socket.voiceRoomJoinedAt) {
            const durationSeconds = Math.round((Date.now() - socket.voiceRoomJoinedAt) / 1000);
            if (durationSeconds > 0) {
                try {
                    const { trackUserVoiceTime } = require('../utils/familyXpUtils');
                    await trackUserVoiceTime(db, socket.user.id, durationSeconds);
                } catch (xpErr) {
                    console.error('[FamilyXP-PartyVoiceChange] Failed to track voice time:', xpErr.message);
                }
            }
        }
        if (socket.user) {
            socket.voiceRoomJoinedAt = Date.now();
            socket.voiceRoomId = roomId;
        }

        const roomName = `party_room_${roomId}`;

        // 1a. Check if user is banned
        if (socket.user) {
            try {
                const banCheck = await db.query(
                    'SELECT id FROM party_room_bans WHERE room_id = $1 AND user_id = $2::text AND is_active = TRUE',
                    [roomId, socket.user.id]
                );
                if (banCheck.rows.length > 0) {
                    socket.emit('party_room_error', { message: 'Bu odadan yasaklandınız.' });
                    socket.emit('moderation:kicked', { roomId, targetUserId: socket.user.id, reason: 'Yasaklı kullanıcı girişi engellendi.' });
                    return;
                }

                // 1b. Determine initial room role
                const roomRes = await db.query('SELECT host_id FROM party_rooms WHERE id = $1', [roomId]);
                const isHost = roomRes.rows.length > 0 && roomRes.rows[0].host_id.toString() === socket.user.id.toString();
                const defaultRole = isHost ? 'room_owner' : 'listener';

                // 1c. Upsert member record
                await db.query(`
                    INSERT INTO party_room_members (room_id, user_id, role, is_online)
                    VALUES ($1, $2::text, $3, TRUE)
                    ON CONFLICT (room_id, user_id)
                    DO UPDATE SET is_online = TRUE, last_active_at = CURRENT_TIMESTAMP
                `, [roomId, socket.user.id, defaultRole]);
            } catch (err) {
                console.error('[SOCKET JOIN] DB membership error:', err.message);
            }
        }

        socket.join(roomName);
        console.log(`[SOCKET] User ${socket.user?.username || socket.id} joined party room: ${roomName}`);

        // Broadcast join event to everyone in the room
        io.to(roomName).emit('user_joined_party', {
            userId: socket.user ? socket.user.id : null,
            username: socket.user ? socket.user.username : 'Misafir',
            avatar: socket.user ? socket.user.avatar_url : null,
            vip_level: socket.user ? socket.user.vip_level : 0
        });

        // Fetch and send current seat status
        try {
            const seatsRes = await db.query(`
                SELECT prs.*, u.username, u.display_name, u.avatar_url, u.vip_level,
                       COALESCE(prm.room_gift_points, 0) as room_gift_points
                FROM party_room_seats prs
                LEFT JOIN users u ON prs.user_id = u.id::text
                LEFT JOIN party_room_members prm ON prs.room_id = prm.room_id AND prs.user_id = prm.user_id
                WHERE prs.room_id = $1
                ORDER BY prs.seat_number ASC
            `, [roomId]);
            
            socket.emit('party_seats_state', seatsRes.rows);
        } catch (err) {
            console.error('[SOCKET] Error fetching seats on join:', err.message);
        }
    });

    // 2. LEAVE PARTY ROOM
    socket.on('leave_party_room', async (data) => {
        const { roomId } = data;
        if (!roomId) return;

        const roomName = `party_room_${roomId}`;
        socket.leave(roomName);
        console.log(`[SOCKET] User ${socket.user?.username || socket.id} left party room: ${roomName}`);

        // If user was on a seat, free it
        if (socket.user) {
            if (socket.voiceRoomJoinedAt) {
                const durationSeconds = Math.round((Date.now() - socket.voiceRoomJoinedAt) / 1000);
                if (durationSeconds > 0) {
                    try {
                        const { trackUserVoiceTime } = require('../utils/familyXpUtils');
                        await trackUserVoiceTime(db, socket.user.id, durationSeconds);
                    } catch (xpErr) {
                        console.error('[FamilyXP-PartyLeave] Failed to track voice time:', xpErr.message);
                    }
                }
                socket.voiceRoomJoinedAt = null;
                socket.voiceRoomId = null;
            }
            try {
                // Set is_online to false in membership
                await db.query('UPDATE party_room_members SET is_online = FALSE WHERE room_id = $1 AND user_id = $2::text', [roomId, socket.user.id]);

                const freeRes = await db.query(`
                    UPDATE party_room_seats 
                    SET user_id = NULL 
                    WHERE room_id = $1 AND user_id = $2::text 
                    RETURNING seat_number
                `, [roomId, socket.user.id]);

                if (freeRes.rows.length > 0) {
                    io.to(roomName).emit('party_seat_updated', {
                        seat_number: freeRes.rows[0].seat_number,
                        user_id: null,
                        username: null,
                        display_name: null,
                        avatar_url: null,
                        vip_level: 0,
                        room_gift_points: 0,
                        is_muted: false
                    });
                }
            } catch (err) {
                console.error('[SOCKET] Error freeing seat on leave:', err.message);
            }
        }

        io.to(roomName).emit('user_left_party', {
            userId: socket.user ? socket.user.id : null
        });
    });

    // 3. REQUEST SEAT (TAKE SEAT)
    socket.on('request_seat', async (data) => {
        const { roomId, seatNumber } = data;
        if (!roomId || !seatNumber || !socket.user) return;

        const roomName = `party_room_${roomId}`;

        try {
            // Check if seat is locked or occupied
            const checkRes = await db.query(
                'SELECT user_id, is_locked FROM party_room_seats WHERE room_id = $1 AND seat_number = $2',
                [roomId, seatNumber]
            );

            if (checkRes.rows.length > 0) {
                const seat = checkRes.rows[0];
                if (seat.is_locked) {
                    socket.emit('party_room_error', { message: 'Bu koltuk şu an kilitli.' });
                    return;
                }
                if (seat.user_id) {
                    socket.emit('party_room_error', { message: 'Bu koltuk zaten dolu.' });
                    return;
                }
            }

            // Free any other seat the user might occupy in this room first and get their numbers
            const oldSeatRes = await db.query(
                'UPDATE party_room_seats SET user_id = NULL WHERE room_id = $1 AND user_id = $2::text RETURNING seat_number',
                [roomId, socket.user.id]
            );

            // Emit update for the old seat(s) if any were cleared
            if (oldSeatRes.rows.length > 0) {
                oldSeatRes.rows.forEach(row => {
                    io.to(roomName).emit('party_seat_updated', {
                        seat_number: row.seat_number,
                        user_id: null,
                        username: null,
                        display_name: null,
                        avatar_url: null,
                        vip_level: 0,
                        room_gift_points: 0,
                        is_muted: false
                    });
                });
            }

            // Insert the seat
            await db.query(`
                INSERT INTO party_room_seats (room_id, seat_number, user_id)
                VALUES ($1, $2, $3::text)
                ON CONFLICT (room_id, seat_number) 
                DO UPDATE SET user_id = EXCLUDED.user_id
            `, [roomId, seatNumber, socket.user.id]);

            // Fetch latest user details (display_name, avatar_url, vip_level)
            const userRes = await db.query(
                'SELECT id, username, display_name, avatar_url, vip_level FROM users WHERE id::text = $1::text',
                [socket.user.id]
            );
            const dbUser = userRes.rows[0] || socket.user;

            io.to(roomName).emit('party_seat_updated', {
                seat_number: seatNumber,
                user_id: socket.user.id,
                username: dbUser.username,
                display_name: dbUser.display_name,
                avatar_url: dbUser.avatar_url,
                vip_level: dbUser.vip_level,
                is_muted: false
            });
        } catch (err) {
            console.error('[SOCKET] Take seat error:', err.message);
            socket.emit('party_room_error', { message: 'Koltuk alma işlemi başarısız.' });
        }
    });

    // 4. LEAVE SEAT
    socket.on('leave_seat', async (data) => {
        const { roomId, seatNumber } = data;
        if (!roomId || !seatNumber || !socket.user) return;

        const roomName = `party_room_${roomId}`;

        try {
            const result = await db.query(
                'UPDATE party_room_seats SET user_id = NULL WHERE room_id = $1 AND seat_number = $2 AND user_id = $3::text RETURNING seat_number',
                [roomId, seatNumber, socket.user.id]
            );

            if (result.rows.length > 0) {
                io.to(roomName).emit('party_seat_updated', {
                    seat_number: seatNumber,
                    user_id: null,
                    username: null,
                    display_name: null,
                    avatar_url: null,
                    vip_level: 0,
                    room_gift_points: 0,
                    is_muted: false
                });
            }
        } catch (err) {
            console.error('[SOCKET] Leave seat error:', err.message);
        }
    });

    // 5. TOGGLE SEAT MUTE (HOST OR MIC OWNER)
    socket.on('toggle_seat_mute', async (data) => {
        const { roomId, seatNumber } = data;
        if (!roomId || !seatNumber || !socket.user) return;

        const roomName = `party_room_${roomId}`;

        try {
            // Verify if user is host or is currently sitting on the seat
            const authRes = await db.query(`
                SELECT prs.user_id, pr.host_id 
                FROM party_room_seats prs
                JOIN party_rooms pr ON prs.room_id = pr.id
                WHERE prs.room_id = $1 AND prs.seat_number = $2
            `, [roomId, seatNumber]);

            if (authRes.rows.length === 0) return;

            const { user_id, host_id } = authRes.rows[0];
            const isHost = host_id.toString() === socket.user.id.toString();
            const isOccupant = user_id && user_id.toString() === socket.user.id.toString();

            if (!isHost && !isOccupant) {
                socket.emit('party_room_error', { message: 'Bu işlem için yetkiniz yok.' });
                return;
            }

            const updateRes = await db.query(
                'UPDATE party_room_seats SET is_muted = NOT is_muted WHERE room_id = $1 AND seat_number = $2 RETURNING is_muted, user_id',
                [roomId, seatNumber]
            );

            if (updateRes.rows.length > 0) {
                const seat = updateRes.rows[0];
                io.to(roomName).emit('party_seat_mute_changed', {
                    seat_number: seatNumber,
                    is_muted: seat.is_muted,
                    user_id: seat.user_id
                });
            }
        } catch (err) {
            console.error('[SOCKET] Toggle mute error:', err.message);
        }
    });

    // 6. LOCK/UNLOCK SEAT (HOST ONLY)
    socket.on('lock_seat', async (data) => {
        const { roomId, seatNumber, isLocked } = data;
        if (!roomId || !seatNumber || !socket.user) return;

        const roomName = `party_room_${roomId}`;

        try {
            // Verify host
            const hostRes = await db.query('SELECT host_id FROM party_rooms WHERE id = $1', [roomId]);
            if (hostRes.rows.length === 0 || hostRes.rows[0].host_id.toString() !== socket.user.id.toString()) {
                socket.emit('party_room_error', { message: 'Sadece oda yöneticisi koltukları kilitleyebilir.' });
                return;
            }

            // Lock and kick out user if sitting on it
            await db.query(
                'UPDATE party_room_seats SET is_locked = $1, user_id = CASE WHEN $1 = true THEN NULL ELSE user_id END WHERE room_id = $2 AND seat_number = $3',
                [isLocked, roomId, seatNumber]
            );

            io.to(roomName).emit('party_seat_lock_changed', {
                seat_number: seatNumber,
                is_locked: isLocked
            });
        } catch (err) {
            console.error('[SOCKET] Lock seat error:', err.message);
        }
    });

    // 7. ROOM CHAT MESSAGE
    socket.on('send_party_message', (data) => {
        const { roomId, content } = data;
        if (!roomId || !content || !socket.user) return;

        const roomName = `party_room_${roomId}`;
        io.to(roomName).emit('receive_party_message', {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            content,
            sender: {
                id: socket.user.id,
                username: socket.user.username,
                display_name: socket.user.display_name,
                avatar_url: socket.user.avatar_url,
                vip_level: socket.user.vip_level
            },
            created_at: new Date()
        });
    });

    // 7a. ROOM EMOJI REACTION
    socket.on('send_party_reaction', (data) => {
        console.log('[SOCKET] send_party_reaction received:', data, 'from user:', socket.user?.username);
        const { roomId, emoji } = data;
        if (!roomId || !emoji || !socket.user) return;

        const roomName = `party_room_${roomId}`;
        console.log('[SOCKET] Broadcasting receive_party_reaction to room:', roomName);
        io.to(roomName).emit('receive_party_reaction', {
            userId: socket.user.id,
            username: socket.user.username,
            emoji
        });
    });

    // 8. SEND VIRTUAL GIFT TO SEAT OWNER
    socket.on('send_party_gift', async (data) => {
        const { roomId, targetUserId, giftId, quantity = 1, idempotencyKey } = data;
        if (!roomId || !targetUserId || !giftId || !socket.user) return;

        if (idempotencyKey) {
            if (inMemoryPartyIdempotencyKeys.has(idempotencyKey) || pendingPartyIdempotencyKeys.has(idempotencyKey)) {
                console.log(`[Idempotency In-Memory Party] Key ${idempotencyKey} already processed or pending.`);
                return socket.emit('gift_success', { idempotencyKey, duplicate: true });
            }
            pendingPartyIdempotencyKeys.add(idempotencyKey);
        }

        const roomName = `party_room_${roomId}`;
        const senderId = socket.user.id;

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Fetch gift details
            const giftRes = await client.query('SELECT * FROM gifts WHERE id = $1', [giftId]);
            if (giftRes.rows.length === 0) throw new Error('Geçersiz hediye.');
            const gift = giftRes.rows[0];

            // 2. Fetch sender balance
            const senderRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [senderId]);
            if (senderRes.rows.length === 0) throw new Error('Gönderici bulunamadı.');
            const balance = parseFloat(senderRes.rows[0].balance || 0);

            if (balance < gift.cost) {
                socket.emit('party_room_error', { message: `Yetersiz bakiye. Bu hediye için ${gift.cost} Coin gerekli.` });
                await client.query('ROLLBACK');
                return;
            }

            // 3. Deduct coins from sender
            await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [gift.cost, senderId]);

            // 4. Save transaction log
            await client.query(`
                INSERT INTO transactions (user_id, amount, type, description)
                VALUES ($1, $2, 'spend_gift', $3)
            `, [senderId, -gift.cost, `Parti odasında hediye gönderimi: ${gift.name}`]);

            // 5. Award diamonds and record operator commission (if recipient is operator/female)
            // Resolve actual roles by checking recipient gender
            const recRes = await client.query('SELECT id, gender, role, agency_id FROM users WHERE id::text = $1::text', [targetUserId]);
            if (recRes.rows.length > 0) {
                const recipient = recRes.rows[0];
                const isFemale = (recipient.gender || '').toLowerCase() === 'kadin';
                
                if (isFemale) {
                    const baseRate = 4.35; // Standard paying conversion rate
                    const earned = Math.round(gift.cost * baseRate * 100) / 100;

                    // Ensure operator entry exists
                    await client.query(`
                        INSERT INTO operators (user_id, category, bio, photos, is_online, rating)
                        VALUES ($1::text::UUID, 'Genel', 'Merhaba!', '{}', false, 5.0)
                        ON CONFLICT (user_id) DO NOTHING
                    `, [targetUserId]);

                    // Update operator pending_balance
                    await client.query(`
                        UPDATE operators 
                        SET pending_balance = COALESCE(pending_balance, 0) + $1, 
                            lifetime_earnings = COALESCE(lifetime_earnings, 0) + $1 
                        WHERE user_id::text = $2::text
                    `, [earned, targetUserId]);

                    // Agency split
                    if (recipient.agency_id) {
                        const agencyRes = await client.query('SELECT commission_rate FROM agencies WHERE id = $1 AND status = \'active\'', [recipient.agency_id]);
                        if (agencyRes.rows.length > 0) {
                            const agencyRate = parseFloat(agencyRes.rows[0].commission_rate || 0.40);
                            const agencyEarned = earned * agencyRate;
                            await client.query(`
                                UPDATE agencies 
                                SET pending_balance = COALESCE(pending_balance, 0) + $1, 
                                    lifetime_earnings = COALESCE(lifetime_earnings, 0) + $1 
                                WHERE id = $2
                            `, [agencyEarned, recipient.agency_id]);
                        }
                    }

                    // Write commission log
                    await client.query(`
                        INSERT INTO commission_logs (operator_id, amount, type, agency_id)
                        VALUES ($1::text::UUID, $2, 'gift', $3)
                    `, [targetUserId, earned, recipient.agency_id]);
                }
            }

            // Increment room_gift_points for recipient in the room session
            await client.query(`
                UPDATE party_room_members
                SET room_gift_points = COALESCE(room_gift_points, 0) + $1
                WHERE room_id = $2 AND user_id = $3
            `, [gift.cost, roomId, targetUserId]);

            // Award Family XP for party room gift
            try {
                const { handleGiftFamilyXp } = require('../utils/familyXpUtils');
                await handleGiftFamilyXp(client, senderId, targetUserId, gift.cost);
            } catch (xpErr) {
                console.error('[FamilyXP-Party] Failed to award family XP:', xpErr.message);
            }

            await client.query('COMMIT');

            if (idempotencyKey) {
                inMemoryPartyIdempotencyKeys.add(idempotencyKey);
                setTimeout(() => inMemoryPartyIdempotencyKeys.delete(idempotencyKey), 86400 * 1000);
            }

            socket.emit('gift_success', { idempotencyKey, duplicate: false });

            // Broadcast balance update to sender
            const newBalRes = await client.query('SELECT balance FROM users WHERE id = $1', [senderId]);
            const newBalance = newBalRes.rows[0].balance;
            socket.emit('balance_update', { userId: senderId, newBalance });

            // Fetch updated room gift points
            const pointsRes = await client.query(`
                SELECT room_gift_points 
                FROM party_room_members 
                WHERE room_id = $1 AND user_id = $2
            `, [roomId, targetUserId]);
            const receiverRoomGiftPoints = pointsRes.rows.length > 0 ? parseInt(pointsRes.rows[0].room_gift_points || 0) : gift.cost;

            // Broadcast room:gift_received to everyone in the room
            io.to(roomName).emit('room:gift_received', {
                roomId,
                senderId,
                receiverId: targetUserId,
                giftId: gift.id,
                giftName: gift.name,
                giftValue: gift.cost,
                receiverRoomGiftPoints
            });

            // Broadcast gift event to room
            io.to(roomName).emit('party_gift_sent', {
                gift_id: gift.id,
                gift_name: gift.name,
                gift_cost: gift.cost,
                gift_icon: gift.icon_url,
                sender: {
                    id: socket.user.id,
                    username: socket.user.username,
                    display_name: socket.user.display_name,
                    avatar_url: socket.user.avatar_url
                },
                recipient_id: targetUserId
            });

        } catch (err) {
            await client.query('ROLLBACK');
            if (idempotencyKey) {
                pendingPartyIdempotencyKeys.delete(idempotencyKey);
            }
            console.error('[SOCKET] Send party gift error:', err.message);
            socket.emit('party_room_error', { message: 'Hediye gönderilirken bir hata oluştu.' });
        } finally {
            if (idempotencyKey) {
                pendingPartyIdempotencyKeys.delete(idempotencyKey);
            }
            client.release();
        }
    });

    // 9. CLEAN UP ON DISCONNECT
    socket.on('disconnect', async () => {
        if (socket.user) {
            // Track voice stay time
            if (socket.voiceRoomJoinedAt) {
                const durationSeconds = Math.round((Date.now() - socket.voiceRoomJoinedAt) / 1000);
                if (durationSeconds > 0) {
                    try {
                        const { trackUserVoiceTime } = require('../utils/familyXpUtils');
                        await trackUserVoiceTime(db, socket.user.id, durationSeconds);
                    } catch (xpErr) {
                        console.error('[FamilyXP-PartyDisconnect] Failed to track voice time:', xpErr.message);
                    }
                }
            }
            try {
                // Set is_online to false across all party rooms for this user
                await db.query('UPDATE party_room_members SET is_online = FALSE WHERE user_id = $1::text', [socket.user.id]);

                // Free any seats occupied by this user across any rooms
                const checkSeats = await db.query(
                    'UPDATE party_room_seats SET user_id = NULL WHERE user_id = $1::text RETURNING room_id, seat_number',
                    [socket.user.id]
                );

                checkSeats.rows.forEach(seat => {
                    const rName = `party_room_${seat.room_id}`;
                    io.to(rName).emit('party_seat_updated', {
                        seat_number: seat.seat_number,
                        user_id: null,
                        username: null,
                        display_name: null,
                        avatar_url: null,
                        vip_level: 0,
                        room_gift_points: 0,
                        is_muted: false
                    });
                });
            } catch (err) {
                console.error('[SOCKET] Disconnect cleanup error:', err.message);
            }
        }
    });
}

module.exports = { handlePartyRoomSockets };
