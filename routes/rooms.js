const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const { authenticateToken } = require('../middleware/auth');
const { createClient } = require('redis');
const { getRtcProvider } = require('../utils/rtcProvider');

// Optional Redis Client for seat state caching
let redisClient = null;
if (process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.connect()
        .then(() => console.log('📡 [Redis] Connected successfully for Room Seats caching.'))
        .catch(err => console.error('❌ [Redis] Connection failed:', err.message));
}

const { handleRoomsSockets } = require('../socket/roomsSocket');

// Lazy Socket.io integration hook using Express middleware
let socketInitialized = false;
router.use((req, res, next) => {
    const io = req.app.get('io');
    if (io && !socketInitialized) {
        io.on('connection', (socket) => {
            handleRoomsSockets(io, socket);
        });
        socketInitialized = true;
        console.log('📡 [SOCKET.IO] Room Seats Socket Handlers mounted successfully!');
    }
    next();
});

// Helper to support both snake_case and camelCase attributes
function mapRoom(row) {
    if (!row) return null;
    return {
        id: row.id,
        ownerUserId: row.owner_user_id,
        owner_user_id: row.owner_user_id,
        roomCode: row.room_code,
        room_code: row.room_code,
        name: row.name,
        description: row.description,
        backgroundImageUrl: row.background_image_url,
        background_image_url: row.background_image_url,
        coverImageUrl: row.cover_image_url,
        cover_image_url: row.cover_image_url,
        roomType: row.room_type,
        room_type: row.room_type,
        maxSeats: row.max_seats,
        max_seats: row.max_seats,
        isPrivate: row.is_private,
        is_private: row.is_private,
        passwordHash: row.password_hash,
        password_hash: row.password_hash,
        status: row.status,
        createdAt: row.created_at,
        created_at: row.created_at,
        updatedAt: row.updated_at,
        updated_at: row.updated_at
    };
}

function mapRoomMember(row) {
    if (!row) return null;
    return {
        id: row.id,
        roomId: row.room_id,
        room_id: row.room_id,
        userId: row.user_id,
        user_id: row.user_id,
        role: row.role,
        isMuted: row.is_muted,
        is_muted: row.is_muted,
        isChatBanned: row.is_chat_banned,
        is_chat_banned: row.is_chat_banned,
        joinedAt: row.joined_at,
        joined_at: row.joined_at,
        leftAt: row.left_at,
        left_at: row.left_at,
        username: row.username,
        displayName: row.display_name,
        display_name: row.display_name,
        avatarUrl: row.avatar_url,
        avatar_url: row.avatar_url
    };
}

function mapSeat(row) {
    if (!row) return null;
    return {
        id: row.id,
        roomId: row.room_id,
        room_id: row.room_id,
        seatIndex: row.seat_index,
        seat_index: row.seat_index,
        userId: row.user_id,
        user_id: row.user_id,
        isLocked: row.is_locked,
        is_locked: row.is_locked,
        micOn: row.mic_on,
        mic_on: row.mic_on,
        seatRole: row.seat_role,
        seat_role: row.seat_role,
        updatedAt: row.updated_at,
        updated_at: row.updated_at,
        // Joined details
        username: row.username,
        displayName: row.display_name,
        display_name: row.display_name,
        avatarUrl: row.avatar_url,
        avatar_url: row.avatar_url
    };
}

// Broadcast updated seats state to everyone in the room
async function broadcastSeatsState(io, roomId) {
    try {
        const seatsRes = await db.query(`
            SELECT rs.*, u.username, u.display_name, u.avatar_url
            FROM room_seats rs
            LEFT JOIN users u ON rs.user_id = u.id
            WHERE rs.room_id = $1
            ORDER BY rs.seat_index ASC
        `, [roomId]);

        const seats = seatsRes.rows.map(mapSeat);

        // Update Redis Cache if active
        if (redisClient && redisClient.isOpen) {
            await redisClient.set(`room:${roomId}:seats`, JSON.stringify(seats));
        }

        if (io) {
            io.to(`room_${roomId}`).emit('seats_state', seats);
            console.log(`[Seats Socket] Broadcasted seats_state for room ${roomId}`);
        }
    } catch (err) {
        console.error('[Seats Broadcast Error]:', err.message);
    }
}

// Generate unique 6-digit room code
async function generateUniqueRoomCode() {
    let code;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
        const res = await db.query('SELECT id FROM rooms WHERE room_code = $1', [code]);
        if (res.rows.length === 0) {
            isUnique = true;
        }
        attempts++;
    }
    if (!isUnique) {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    return code;
}

// POST /rooms - Create room and auto-populate seats
router.post('/', authenticateToken, async (req, res) => {
    const { 
        name, 
        description, 
        backgroundImageUrl, 
        background_image_url,
        coverImageUrl,
        cover_image_url,
        roomType,
        room_type,
        maxSeats,
        max_seats,
        isPrivate,
        is_private,
        password 
    } = req.body;

    const ownerUserId = req.user.id;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Oda adı gereklidir.' });
    }

    const bgUrl = backgroundImageUrl || background_image_url || null;
    const cvUrl = coverImageUrl || cover_image_url || null;
    const rType = roomType || room_type || 'voice';
    const mSeats = maxSeats !== undefined ? maxSeats : (max_seats !== undefined ? max_seats : 12);
    const isPriv = isPrivate !== undefined ? isPrivate : (is_private !== undefined ? is_private : false);

    let pwdHash = null;
    if (password) {
        pwdHash = await bcrypt.hash(password, 10);
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const roomCode = await generateUniqueRoomCode();

        const roomInsert = await client.query(`
            INSERT INTO rooms (
                owner_user_id, room_code, name, description, 
                background_image_url, cover_image_url, room_type, 
                max_seats, is_private, password_hash, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
            RETURNING *
        `, [ownerUserId, roomCode, name.trim(), description || null, bgUrl, cvUrl, rType, mSeats, isPriv, pwdHash]);

        const room = roomInsert.rows[0];

        // Owner becomes member automatically
        await client.query(`
            INSERT INTO room_members (room_id, user_id, role, is_muted, is_chat_banned)
            VALUES ($1, $2, 'owner', false, false)
        `, [room.id, ownerUserId]);

        // Auto-create room seats up to maxSeats
        for (let i = 0; i < mSeats; i++) {
            await client.query(`
                INSERT INTO room_seats (room_id, seat_index, user_id, is_locked, mic_on, seat_role)
                VALUES ($1, $2, NULL, false, false, 'normal')
            `, [room.id, i]);
        }

        await client.query('COMMIT');
        res.status(201).json(mapRoom(room));
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Rooms] Create Room error:', err.message);
        res.status(500).json({ error: 'Oda oluşturulamadı.' });
    } finally {
        client.release();
    }
});

// GET /rooms - List active rooms
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT r.*, u.username as owner_username, u.display_name as owner_display_name,
                   (SELECT COUNT(*) FROM room_members WHERE room_id = r.id AND left_at IS NULL) as member_count
            FROM rooms r
            LEFT JOIN users u ON r.owner_user_id = u.id
            WHERE r.status = 'active'
            ORDER BY r.created_at DESC
        `);

        const rooms = result.rows.map(row => {
            const room = mapRoom(row);
            room.ownerUsername = row.owner_username;
            room.ownerDisplayName = row.owner_display_name;
            room.memberCount = parseInt(row.member_count || 0);
            return room;
        });

        res.json(rooms);
    } catch (err) {
        console.error('[Rooms] List Rooms error:', err.message);
        res.status(500).json({ error: 'Odalar listelenirken hata oluştu.' });
    }
});

// GET /rooms/:id - Get room detail and its active members
router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        let roomQuery;
        let queryParams;
        
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            roomQuery = 'SELECT * FROM rooms WHERE id = $1';
            queryParams = [id];
        } else {
            roomQuery = 'SELECT * FROM rooms WHERE room_code = $1';
            queryParams = [id];
        }

        const roomRes = await db.query(roomQuery, queryParams);
        if (roomRes.rows.length === 0) {
            return res.status(404).json({ error: 'Oda bulunamadı.' });
        }

        const room = mapRoom(roomRes.rows[0]);

        // Fetch active members
        const membersRes = await db.query(`
            SELECT rm.*, u.username, u.display_name, u.avatar_url
            FROM room_members rm
            JOIN users u ON rm.user_id = u.id
            WHERE rm.room_id = $1 AND rm.left_at IS NULL
        `, [room.id]);

        room.members = membersRes.rows.map(mapRoomMember);

        res.json(room);
    } catch (err) {
        console.error('[Rooms] Get Room error:', err.message);
        res.status(500).json({ error: 'Oda detayları alınamadı.' });
    }
});

// PATCH /rooms/:id - Update room properties
router.patch('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { 
        name, 
        description, 
        backgroundImageUrl, 
        background_image_url,
        coverImageUrl,
        cover_image_url,
        roomType,
        room_type,
        maxSeats,
        max_seats,
        isPrivate,
        is_private,
        password
    } = req.body;

    const userId = req.user.id;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

    try {
        const roomRes = await db.query('SELECT * FROM rooms WHERE id = $1', [id]);
        if (roomRes.rows.length === 0) {
            return res.status(404).json({ error: 'Oda bulunamadı.' });
        }

        const room = roomRes.rows[0];

        // Authorization check
        if (room.owner_user_id.toString() !== userId.toString() && !isAdmin) {
            return res.status(403).json({ error: 'Bu odayı güncelleme yetkiniz yok.' });
        }

        const bgUrl = backgroundImageUrl !== undefined ? backgroundImageUrl : (background_image_url !== undefined ? background_image_url : room.background_image_url);
        const cvUrl = coverImageUrl !== undefined ? coverImageUrl : (cover_image_url !== undefined ? cover_image_url : room.cover_image_url);
        const rType = roomType !== undefined ? roomType : (room_type !== undefined ? room_type : room.room_type);
        const mSeats = maxSeats !== undefined ? maxSeats : (max_seats !== undefined ? max_seats : room.max_seats);
        const isPriv = isPrivate !== undefined ? isPrivate : (is_private !== undefined ? is_private : room.is_private);

        let pwdHash = room.password_hash;
        if (password !== undefined) {
            pwdHash = password ? await bcrypt.hash(password, 10) : null;
        }

        const updateRes = await db.query(`
            UPDATE rooms 
            SET name = COALESCE($1, name),
                description = $2,
                background_image_url = $3,
                cover_image_url = $4,
                room_type = $5,
                max_seats = $6,
                is_private = $7,
                password_hash = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING *
        `, [name ? name.trim() : null, description, bgUrl, cvUrl, rType, mSeats, isPriv, pwdHash, id]);

        res.json(mapRoom(updateRes.rows[0]));
    } catch (err) {
        console.error('[Rooms] Update Room error:', err.message);
        res.status(500).json({ error: 'Oda güncellenemedi.' });
    }
});

// POST /rooms/:id/join - Join room
router.post('/:id/join', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const roomRes = await db.query('SELECT * FROM rooms WHERE id = $1', [id]);
        if (roomRes.rows.length === 0) {
            return res.status(404).json({ error: 'Oda bulunamadı.' });
        }

        const room = roomRes.rows[0];

        if (room.status !== 'active') {
            return res.status(400).json({ error: 'Bu oda aktif değil.' });
        }

        // Check if user is already an active member
        const memberCheck = await db.query(
            'SELECT * FROM room_members WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL',
            [id, userId]
        );

        if (memberCheck.rows.length > 0) {
            return res.json(mapRoomMember(memberCheck.rows[0]));
        }

        const role = room.owner_user_id.toString() === userId.toString() ? 'owner' : 'member';

        const joinInsert = await db.query(`
            INSERT INTO room_members (room_id, user_id, role, is_muted, is_chat_banned, joined_at, left_at)
            VALUES ($1, $2, $3, false, false, CURRENT_TIMESTAMP, NULL)
            RETURNING *
        `, [id, userId, role]);

        res.status(201).json(mapRoomMember(joinInsert.rows[0]));
    } catch (err) {
        console.error('[Rooms] Join Room error:', err.message);
        res.status(500).json({ error: 'Odaya katılım sağlanamadı.' });
    }
});

// POST /rooms/:id/leave - Leave room
router.post('/:id/leave', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(`
            UPDATE room_members 
            SET left_at = CURRENT_TIMESTAMP
            WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
            RETURNING *
        `, [id, userId]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Bu odada aktif üyeliğiniz bulunmuyor.' });
        }

        // Free the user's seat if they occupied one
        const seatFree = await client.query(`
            UPDATE room_seats 
            SET user_id = NULL, mic_on = false
            WHERE room_id = $1 AND user_id = $2
            RETURNING seat_index
        `, [id, userId]);

        await client.query('COMMIT');

        // Broadcast if they left a seat
        if (seatFree.rows.length > 0) {
            broadcastSeatsState(req.app.get('io'), id);
        }

        res.json({ success: true, message: 'Odadan başarıyla ayrıldınız.', member: mapRoomMember(result.rows[0]) });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Rooms] Leave Room error:', err.message);
        res.status(500).json({ error: 'Odadan ayrılma işlemi başarısız.' });
    } finally {
        client.release();
    }
});

// POST /rooms/:id/close - Close room (sets status = closed, emits socket event)
router.post('/:id/close', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const roomRes = await client.query('SELECT * FROM rooms WHERE id = $1', [id]);
        if (roomRes.rows.length === 0) {
            return res.status(404).json({ error: 'Oda bulunamadı.' });
        }

        const room = roomRes.rows[0];

        if (room.owner_user_id.toString() !== userId.toString() && !isAdmin) {
            return res.status(403).json({ error: 'Bu odayı kapatma yetkiniz yok.' });
        }

        // Close room
        await client.query(`
            UPDATE rooms 
            SET status = 'closed', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [id]);

        // Kick everyone out
        await client.query(`
            UPDATE room_members 
            SET left_at = CURRENT_TIMESTAMP
            WHERE room_id = $1 AND left_at IS NULL
        `, [id]);

        // Clear all seats
        await client.query(`
            UPDATE room_seats 
            SET user_id = NULL, mic_on = false
            WHERE room_id = $1
        `, [id]);

        await client.query('COMMIT');

        // Broadcast close event via socket
        const io = req.app.get('io');
        if (io) {
            io.to(`room_${id}`).emit('room_closed', { roomId: id });
        }

        res.json({ success: true, message: 'Oda başarıyla kapatıldı.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Rooms] Close Room error:', err.message);
        res.status(500).json({ error: 'Oda kapatılamadı.' });
    } finally {
        client.release();
    }
});


// ==========================================
// FAZ 3: SEAT (KOLTUK) ENDPOINTS
// ==========================================

// GET /rooms/:id/seats - Fetch all seats for the room
router.get('/:id/seats', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Try loading from Redis Cache first
        if (redisClient && redisClient.isOpen) {
            const cached = await redisClient.get(`room:${id}:seats`);
            if (cached) {
                return res.json(JSON.parse(cached));
            }
        }

        const seatsRes = await db.query(`
            SELECT rs.*, u.username, u.display_name, u.avatar_url
            FROM room_seats rs
            LEFT JOIN users u ON rs.user_id = u.id
            WHERE rs.room_id = $1
            ORDER BY rs.seat_index ASC
        `, [id]);

        const seats = seatsRes.rows.map(mapSeat);

        // Update cache
        if (redisClient && redisClient.isOpen) {
            await redisClient.set(`room:${id}:seats`, JSON.stringify(seats));
        }

        res.json(seats);
    } catch (err) {
        console.error('[Seats API] GET error:', err.message);
        res.status(500).json({ error: 'Koltuk bilgileri alınamadı.' });
    }
});

// POST /rooms/:id/seats/:index/take - User takes a seat
router.post('/:id/seats/:index/take', authenticateToken, async (req, res) => {
    const { id, index } = req.params;
    const userId = req.user.id;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

    const seatIdx = parseInt(index);

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Check if user is banned
        if (req.user.account_status === 'banned') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Banlı kullanıcı koltuğa oturamaz.' });
        }

        // 2. Check if user is actively in the room (left_at IS NULL)
        const memberCheck = await client.query(`
            SELECT role FROM room_members 
            WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
        `, [id, userId]);

        if (memberCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Kullanıcı odada aktif bulunmadığından koltuğa oturamaz.' });
        }

        const userRoleInRoom = memberCheck.rows[0].role; // owner, admin, member, guest

        // 3. Fetch room owner to check permissions
        const roomRes = await client.query('SELECT owner_user_id FROM rooms WHERE id = $1', [id]);
        if (roomRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Oda bulunamadı.' });
        }
        const isOwner = roomRes.rows[0].owner_user_id.toString() === userId.toString();

        // 4. Fetch the target seat
        const seatRes = await client.query(`
            SELECT * FROM room_seats 
            WHERE room_id = $1 AND seat_index = $2
            FOR UPDATE
        `, [id, seatIdx]);

        if (seatRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Belirtilen koltuk bulunamadı.' });
        }

        const seat = seatRes.rows[0];

        // 5. If seat is locked, only owner or admin can occupy it
        if (seat.is_locked && !isOwner && !isAdmin && userRoleInRoom !== 'admin' && userRoleInRoom !== 'owner') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Bu koltuk kilitlidir. Sadece oda yöneticileri oturabilir.' });
        }

        // 6. Check if the seat is already taken
        if (seat.user_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Bu koltuk zaten dolu.' });
        }

        // 7. Rule: Each user can only sit on ONE seat. Free previous seat if any in this room.
        await client.query(`
            UPDATE room_seats 
            SET user_id = NULL, mic_on = false
            WHERE room_id = $1 AND user_id = $2
        `, [id, userId]);

        // 8. Determine seat role (defaults to host if user is owner/room admin, otherwise normal or vip depending on user level/vipLevel)
        let seatRole = 'normal';
        if (isOwner || userRoleInRoom === 'owner' || userRoleInRoom === 'admin') {
            seatRole = 'host';
        } else if (req.user.vip_level && req.user.vip_level > 0) {
            seatRole = 'vip';
        }

        // 9. Occupy the seat
        const updateRes = await client.query(`
            UPDATE room_seats 
            SET user_id = $1, seat_role = $2, mic_on = false, updated_at = CURRENT_TIMESTAMP
            WHERE room_id = $3 AND seat_index = $4
            RETURNING *
        `, [userId, seatRole, id, seatIdx]);

        await client.query('COMMIT');

        // Broadcast seats update to room
        broadcastSeatsState(req.app.get('io'), id);

        res.json(mapSeat(updateRes.rows[0]));
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Seats API] TAKE error:', err.message);
        res.status(500).json({ error: 'Koltuk alma işlemi başarısız.' });
    } finally {
        client.release();
    }
});

// POST /rooms/:id/seats/:index/leave - User leaves their seat
router.post('/:id/seats/:index/leave', authenticateToken, async (req, res) => {
    const { id, index } = req.params;
    const userId = req.user.id;
    const seatIdx = parseInt(index);

    try {
        // Rule: Normal users can only leave their own seat.
        const result = await db.query(`
            UPDATE room_seats 
            SET user_id = NULL, mic_on = false, seat_role = 'normal', updated_at = CURRENT_TIMESTAMP
            WHERE room_id = $1 AND seat_index = $2 AND user_id = $3
            RETURNING *
        `, [id, seatIdx, userId]);

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Bu koltukta oturmuyorsunuz, kalkamazsınız.' });
        }

        // Broadcast seats update
        broadcastSeatsState(req.app.get('io'), id);

        res.json({ success: true, message: 'Koltuktan başarıyla kalktınız.', seat: mapSeat(result.rows[0]) });
    } catch (err) {
        console.error('[Seats API] LEAVE error:', err.message);
        res.status(500).json({ error: 'Koltuktan kalkma işlemi başarısız.' });
    }
});

// POST /rooms/:id/seats/:index/lock - Lock a seat
router.post('/:id/seats/:index/lock', authenticateToken, async (req, res) => {
    const { id, index } = req.params;
    const userId = req.user.id;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    const seatIdx = parseInt(index);

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Check if room exists and get owner
        const roomRes = await client.query('SELECT owner_user_id FROM rooms WHERE id = $1', [id]);
        if (roomRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Oda bulunamadı.' });
        }

        const isOwner = roomRes.rows[0].owner_user_id.toString() === userId.toString();

        // Check user's role in the room
        const memberCheck = await client.query(`
            SELECT role FROM room_members 
            WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
        `, [id, userId]);
        
        const userRole = memberCheck.rows[0]?.role;

        // Rule: Only owner or admin can lock
        if (!isOwner && !isAdmin && userRole !== 'admin' && userRole !== 'owner') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
        }

        // Lock and clear occupant if they are currently sitting
        const updateRes = await client.query(`
            UPDATE room_seats 
            SET is_locked = true, user_id = NULL, mic_on = false, updated_at = CURRENT_TIMESTAMP
            WHERE room_id = $1 AND seat_index = $2
            RETURNING *
        `, [id, seatIdx]);

        await client.query('COMMIT');

        // Broadcast seats update
        broadcastSeatsState(req.app.get('io'), id);

        res.json(mapSeat(updateRes.rows[0]));
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Seats API] LOCK error:', err.message);
        res.status(500).json({ error: 'Koltuk kilitlenemedi.' });
    } finally {
        client.release();
    }
});

// POST /rooms/:id/seats/:index/unlock - Unlock a seat
router.post('/:id/seats/:index/unlock', authenticateToken, async (req, res) => {
    const { id, index } = req.params;
    const userId = req.user.id;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    const seatIdx = parseInt(index);

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Check if room exists and get owner
        const roomRes = await client.query('SELECT owner_user_id FROM rooms WHERE id = $1', [id]);
        if (roomRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Oda bulunamadı.' });
        }

        const isOwner = roomRes.rows[0].owner_user_id.toString() === userId.toString();

        const memberCheck = await client.query(`
            SELECT role FROM room_members 
            WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
        `, [id, userId]);
        
        const userRole = memberCheck.rows[0]?.role;

        // Rule: Only owner or admin can unlock
        if (!isOwner && !isAdmin && userRole !== 'admin' && userRole !== 'owner') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
        }

        const updateRes = await client.query(`
            UPDATE room_seats 
            SET is_locked = false, updated_at = CURRENT_TIMESTAMP
            WHERE room_id = $1 AND seat_index = $2
            RETURNING *
        `, [id, seatIdx]);

        await client.query('COMMIT');

        // Broadcast seats update
        broadcastSeatsState(req.app.get('io'), id);

        res.json(mapSeat(updateRes.rows[0]));
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Seats API] UNLOCK error:', err.message);
        res.status(500).json({ error: 'Koltuk kilidi açılamadı.' });
    } finally {
        client.release();
    }
});

// POST /rooms/:id/seats/:index/kick - Kick occupant from seat
router.post('/:id/seats/:index/kick', authenticateToken, async (req, res) => {
    const { id, index } = req.params;
    const userId = req.user.id;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    const seatIdx = parseInt(index);

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Fetch room owner
        const roomRes = await client.query('SELECT owner_user_id FROM rooms WHERE id = $1', [id]);
        if (roomRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Oda bulunamadı.' });
        }
        const isOwner = roomRes.rows[0].owner_user_id.toString() === userId.toString();

        // 2. Fetch the target seat
        const seatRes = await client.query('SELECT * FROM room_seats WHERE room_id = $1 AND seat_index = $2', [id, seatIdx]);
        if (seatRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Koltuk bulunamadı.' });
        }
        const seat = seatRes.rows[0];

        if (!seat.user_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Koltukta kimse oturmuyor.' });
        }

        // 3. Check target user's role in the room to check privilege level
        const targetMemberCheck = await client.query(`
            SELECT role FROM room_members 
            WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
        `, [id, seat.user_id]);
        const targetRole = targetMemberCheck.rows[0]?.role || 'member';

        // 4. Fetch caller's room membership
        const callerMemberCheck = await client.query(`
            SELECT role FROM room_members 
            WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
        `, [id, userId]);
        const callerRole = callerMemberCheck.rows[0]?.role;

        // Rules:
        // - Owner can kick anyone.
        // - Admins can kick normal users (role member/guest), but not other admins/owner.
        const isCallerAdmin = isAdmin || callerRole === 'admin';
        const isCallerOwner = isOwner || callerRole === 'owner';

        if (!isCallerOwner && !isCallerAdmin) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
        }

        if (isCallerAdmin && !isCallerOwner && (targetRole === 'owner' || targetRole === 'admin')) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Yöneticileri veya oda sahibini koltuktan indiremezsiniz.' });
        }

        // 5. Kick the user
        const updateRes = await client.query(`
            UPDATE room_seats 
            SET user_id = NULL, mic_on = false, seat_role = 'normal', updated_at = CURRENT_TIMESTAMP
            WHERE room_id = $1 AND seat_index = $2
            RETURNING *
        `, [id, seatIdx]);

        await client.query('COMMIT');

        // Broadcast seats update
        broadcastSeatsState(req.app.get('io'), id);

        res.json({ success: true, message: 'Kullanıcı koltuktan indirildi.', seat: mapSeat(updateRes.rows[0]) });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Seats API] KICK error:', err.message);
        res.status(500).json({ error: 'Kullanıcı koltuktan indirilemedi.' });
    } finally {
        client.release();
    }
});

// POST /rooms/:id/seats/:index/mic - Toggle mic state
router.post('/:id/seats/:index/mic', authenticateToken, async (req, res) => {
    const { id, index } = req.params;
    const userId = req.user.id;
    const seatIdx = parseInt(index);

    try {
        // Rule: Only the occupant of the seat can toggle their mic
        const seatRes = await db.query('SELECT user_id FROM room_seats WHERE room_id = $1 AND seat_index = $2', [id, seatIdx]);
        if (seatRes.rows.length === 0) {
            return res.status(404).json({ error: 'Koltuk bulunamadı.' });
        }

        const seat = seatRes.rows[0];
        if (!seat.user_id || seat.user_id.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'Sadece kendi oturduğunuz koltuğun mikrofonunu açıp kapatabilirsiniz.' });
        }

        const updateRes = await db.query(`
            UPDATE room_seats 
            SET mic_on = NOT mic_on, updated_at = CURRENT_TIMESTAMP
            WHERE room_id = $1 AND seat_index = $2
            RETURNING *
        `, [id, seatIdx]);

        // Broadcast seats update
        broadcastSeatsState(req.app.get('io'), id);

        res.json(mapSeat(updateRes.rows[0]));
    } catch (err) {
        console.error('[Seats API] MIC error:', err.message);
        res.status(500).json({ error: 'Mikrofon durumu güncellenemedi.' });
    }
});

// GET /rooms/:id/messages - Fetch chat history with cursor pagination (limit and before)
router.get('/:id/messages', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { limit = 50, before } = req.query;

    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

    try {
        let query = `
            SELECT rm.*, u.username, u.display_name, u.avatar_url
            FROM room_messages rm
            LEFT JOIN users u ON rm.user_id = u.id
            WHERE rm.room_id = $1
        `;
        const queryParams = [id];

        if (before) {
            query += ` AND rm.created_at < $2`;
            queryParams.push(before);
        }

        query += ` ORDER BY rm.created_at DESC LIMIT $${queryParams.length + 1}`;
        queryParams.push(limitNum);

        const result = await db.query(query, queryParams);

        const messages = result.rows.map(row => ({
            id: row.id,
            roomId: row.room_id,
            room_id: row.room_id,
            userId: row.user_id,
            user_id: row.user_id,
            messageType: row.message_type,
            message_type: row.message_type,
            content: row.content,
            metadataJson: row.metadata_json,
            metadata_json: row.metadata_json,
            createdAt: row.created_at,
            created_at: row.created_at,
            username: row.username,
            displayName: row.display_name,
            display_name: row.display_name,
            avatarUrl: row.avatar_url,
            avatar_url: row.avatar_url
        }));

        res.json(messages);
    } catch (err) {
        console.error('[Room Messages API] Error:', err.message);
        res.status(500).json({ error: 'Mesaj geçmişi alınamadı.' });
    }
});

// POST /rooms/:id/rtc-token - Generate RTC Token based on seat and room role mapping
router.post('/:id/rtc-token', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // 1. Fetch room owner to check if user is host
        const roomRes = await db.query('SELECT owner_user_id FROM rooms WHERE id = $1', [id]);
        if (roomRes.rows.length === 0) {
            return res.status(404).json({ error: 'Oda bulunamadı.' });
        }
        
        const isOwner = roomRes.rows[0].owner_user_id.toString() === userId.toString();

        let role = 'listener';

        if (isOwner) {
            role = 'host';
        } else {
            // Check if user is sitting on a seat in this room
            const seatRes = await db.query('SELECT id FROM room_seats WHERE room_id = $1 AND user_id = $2', [id, userId]);
            if (seatRes.rows.length > 0) {
                role = 'speaker';
            }
        }

        // Generate Token using factory provider
        const provider = getRtcProvider();
        const token = await provider.createJoinToken(userId, id, role);

        const providerName = process.env.RTC_PROVIDER || 'mock';

        res.json({
            provider: providerName,
            token,
            channelName: `room_${id}`,
            role
        });

    } catch (err) {
        console.error('[RTC Token API] Error:', err.message);
        res.status(500).json({ error: 'RTC token üretilemedi.' });
    }
});

// ==========================================
// FAZ 8: MODERASYON ENDPOINTS
// ==========================================

// Helper to check caller privileges in a room
async function checkModeratorPrivileges(roomId, callerId, callerRoleGlobal, targetUserId) {
    // 1. Fetch room details
    const roomRes = await db.query('SELECT owner_user_id FROM rooms WHERE id = $1', [roomId]);
    if (roomRes.rows.length === 0) return { error: 'Oda bulunamadı.', status: 404 };
    
    const ownerUserId = roomRes.rows[0].owner_user_id;

    // Admin cannot perform moderation actions on room owner
    if (ownerUserId.toString() === targetUserId.toString()) {
        return { error: 'Oda sahibi üzerinde moderasyon işlemi yapılamaz.', status: 403 };
    }

    // 2. Fetch caller's membership in the room
    const callerMemberRes = await db.query(`
        SELECT role FROM room_members 
        WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
    `, [roomId, callerId]);

    const callerRoomRole = callerMemberRes.rows[0]?.role;
    const isCallerGlobalAdmin = ['admin', 'super_admin'].includes(callerRoleGlobal);
    const isCallerOwner = ownerUserId.toString() === callerId.toString() || callerRoomRole === 'owner';
    const isCallerAdmin = callerRoomRole === 'admin' || isCallerGlobalAdmin;

    if (!isCallerOwner && !isCallerAdmin) {
        return { error: 'Bu işlem için moderatör yetkiniz bulunmuyor.', status: 403 };
    }

    return { success: true, isOwner: isCallerOwner };
}

// POST /rooms/:id/moderation/kick - Kick user from room
router.post('/:id/moderation/kick', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { targetUserId } = req.body;
    const callerId = req.user.id;

    if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId gereklidir.' });
    }

    const check = await checkModeratorPrivileges(id, callerId, req.user.role, targetUserId);
    if (check.error) {
        return res.status(check.status).json({ error: check.error });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Kick user (set left_at)
        const updateRes = await client.query(`
            UPDATE room_members 
            SET left_at = CURRENT_TIMESTAMP
            WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
            RETURNING *
        `, [id, targetUserId]);

        // Vacate seat if occupied
        await client.query(`
            UPDATE room_seats 
            SET user_id = NULL, mic_on = false
            WHERE room_id = $1 AND user_id = $2
        `, [id, targetUserId]);

        // Insert admin action log
        await client.query(`
            INSERT INTO admin_actions (actor_user_id, target_user_id, room_id, action_type, payload_json)
            VALUES ($1, $2, $3, 'kick', NULL)
        `, [callerId, targetUserId, id]);

        await client.query('COMMIT');

        // Broadcast Socket event
        const io = req.app.get('io');
        if (io) {
            io.to(`room_${id}`).emit('moderation', {
                actionType: 'kick',
                action_type: 'kick',
                roomId: id,
                targetUserId
            });
            // Update seats state broadcast
            broadcastSeatsState(io, id);
        }

        res.json({ success: true, message: 'Kullanıcı odadan başarıyla atıldı.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Moderation Kick API] Error:', err.message);
        res.status(500).json({ error: 'Kullanıcı odadan atılamadı.' });
    } finally {
        client.release();
    }
});

// POST /rooms/:id/moderation/mute - Mute user in room
router.post('/:id/moderation/mute', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { targetUserId, isMuted } = req.body;
    const callerId = req.user.id;

    if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId gereklidir.' });
    }

    const check = await checkModeratorPrivileges(id, callerId, req.user.role, targetUserId);
    if (check.error) {
        return res.status(check.status).json({ error: check.error });
    }

    try {
        const currentMuteRes = await db.query(`
            SELECT is_muted FROM room_members 
            WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
        `, [id, targetUserId]);

        if (currentMuteRes.rows.length === 0) {
            return res.status(400).json({ error: 'Kullanıcı odada aktif bulunmuyor.' });
        }

        const muteState = isMuted !== undefined ? isMuted : !currentMuteRes.rows[0].is_muted;

        await db.query(`
            UPDATE room_members 
            SET is_muted = $1
            WHERE room_id = $2 AND user_id = $3 AND left_at IS NULL
        `, [muteState, id, targetUserId]);

        // If muted, turn off their seat mic if they are sitting
        if (muteState) {
            await db.query(`
                UPDATE room_seats 
                SET mic_on = false
                WHERE room_id = $1 AND user_id = $2
            `, [id, targetUserId]);
        }

        // Insert admin action log
        await db.query(`
            INSERT INTO admin_actions (actor_user_id, target_user_id, room_id, action_type, payload_json)
            VALUES ($1, $2, $3, 'mute', $4)
        `, [callerId, targetUserId, id, JSON.stringify({ isMuted: muteState })]);

        // Broadcast Socket event
        const io = req.app.get('io');
        if (io) {
            io.to(`room_${id}`).emit('moderation', {
                actionType: 'mute',
                action_type: 'mute',
                roomId: id,
                targetUserId,
                isMuted: muteState
            });
            // Update seats state broadcast
            broadcastSeatsState(io, id);
        }

        res.json({ success: true, message: `Kullanıcı mikrofonu ${muteState ? 'kapatıldı (muted)' : 'açıldı'}.`, isMuted: muteState });
    } catch (err) {
        console.error('[Moderation Mute API] Error:', err.message);
        res.status(500).json({ error: 'Mute işlemi başarısız.' });
    }
});

// POST /rooms/:id/moderation/chat-ban - Chat ban user in room
router.post('/:id/moderation/chat-ban', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { targetUserId, isChatBanned } = req.body;
    const callerId = req.user.id;

    if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId gereklidir.' });
    }

    const check = await checkModeratorPrivileges(id, callerId, req.user.role, targetUserId);
    if (check.error) {
        return res.status(check.status).json({ error: check.error });
    }

    try {
        const currentBanRes = await db.query(`
            SELECT is_chat_banned FROM room_members 
            WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
        `, [id, targetUserId]);

        if (currentBanRes.rows.length === 0) {
            return res.status(400).json({ error: 'Kullanıcı odada aktif bulunmuyor.' });
        }

        const chatBanState = isChatBanned !== undefined ? isChatBanned : !currentBanRes.rows[0].is_chat_banned;

        await db.query(`
            UPDATE room_members 
            SET is_chat_banned = $1
            WHERE room_id = $2 AND user_id = $3 AND left_at IS NULL
        `, [chatBanState, id, targetUserId]);

        // Insert admin action log
        await db.query(`
            INSERT INTO admin_actions (actor_user_id, target_user_id, room_id, action_type, payload_json)
            VALUES ($1, $2, $3, 'chat-ban', $4)
        `, [callerId, targetUserId, id, JSON.stringify({ isChatBanned: chatBanState })]);

        // Broadcast Socket event
        const io = req.app.get('io');
        if (io) {
            io.to(`room_${id}`).emit('moderation', {
                actionType: 'chat-ban',
                action_type: 'chat-ban',
                roomId: id,
                targetUserId,
                isChatBanned: chatBanState
            });
        }

        res.json({ success: true, message: `Kullanıcı chat sohbet izni ${chatBanState ? 'yasaklandı' : 'verildi'}.`, isChatBanned: chatBanState });
    } catch (err) {
        console.error('[Moderation Chat-Ban API] Error:', err.message);
        res.status(500).json({ error: 'Chat-ban işlemi başarısız.' });
    }
});

// POST /rooms/:id/moderation/assign-role - Promotes/Demotes room member role (Owner only)
router.post('/:id/moderation/assign-role', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { targetUserId, role } = req.body;
    const callerId = req.user.id;
    const isCallerGlobalAdmin = ['admin', 'super_admin'].includes(req.user.role);

    if (!targetUserId || !role) {
        return res.status(400).json({ error: 'Eksik parametre (targetUserId veya role).' });
    }

    if (!['admin', 'member'].includes(role)) {
        return res.status(400).json({ error: 'Geçersiz rol seçimi. Sadece admin veya member atanabilir.' });
    }

    try {
        // Fetch room details
        const roomRes = await db.query('SELECT owner_user_id FROM rooms WHERE id = $1', [id]);
        if (roomRes.rows.length === 0) {
            return res.status(404).json({ error: 'Oda bulunamadı.' });
        }
        
        const isOwner = roomRes.rows[0].owner_user_id.toString() === callerId.toString();

        // Rule: Only Owner or Global Admin can assign roles
        if (!isOwner && !isCallerGlobalAdmin) {
            return res.status(403).json({ error: 'Yönetici atama yetkiniz bulunmamuyor. Sadece oda sahibi admin atayabilir.' });
        }

        const updateRes = await db.query(`
            UPDATE room_members 
            SET role = $1
            WHERE room_id = $2 AND user_id = $3 AND left_at IS NULL
            RETURNING *
        `, [role, id, targetUserId]);

        if (updateRes.rows.length === 0) {
            return res.status(400).json({ error: 'Kullanıcı odada aktif bulunmuyor.' });
        }

        // Insert admin action log
        await db.query(`
            INSERT INTO admin_actions (actor_user_id, target_user_id, room_id, action_type, payload_json)
            VALUES ($1, $2, $3, 'assign-role', $4)
        `, [callerId, targetUserId, id, JSON.stringify({ role })]);

        // Broadcast Socket event
        const io = req.app.get('io');
        if (io) {
            io.to(`room_${id}`).emit('moderation', {
                actionType: 'assign-role',
                action_type: 'assign-role',
                roomId: id,
                targetUserId,
                role
            });
        }

        res.json({ success: true, message: `Kullanıcı rolü '${role}' olarak güncellendi.`, member: mapRoomMember(updateRes.rows[0]) });
    } catch (err) {
        console.error('[Moderation Assign-Role API] Error:', err.message);
        res.status(500).json({ error: 'Rol atanamadı.' });
    }
});

module.exports = router;
