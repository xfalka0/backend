const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { handlePartyRoomSockets } = require('../socket/partyRoomSocket');

// Auto-run schema migrations for party rooms and seats on module load
async function ensurePartyTables() {
    try {
        console.log('[DB] Ensuring party rooms and seats tables exist...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS party_rooms (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(100) NOT NULL,
                host_id TEXT NOT NULL,
                background_url TEXT,
                room_level INT DEFAULT 1,
                is_private BOOLEAN DEFAULT FALSE,
                password VARCHAR(20),
                description TEXT,
                category VARCHAR(50),
                max_speakers INT DEFAULT 8,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Ensure new fields exist on existing tables
        await db.query(`
            ALTER TABLE party_rooms ADD COLUMN IF NOT EXISTS description TEXT;
            ALTER TABLE party_rooms ADD COLUMN IF NOT EXISTS category VARCHAR(50);
            ALTER TABLE party_rooms ADD COLUMN IF NOT EXISTS max_speakers INT DEFAULT 8;
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS party_room_seats (
                id SERIAL PRIMARY KEY,
                room_id UUID REFERENCES party_rooms(id) ON DELETE CASCADE,
                seat_number INT NOT NULL,
                user_id TEXT,
                is_locked BOOLEAN DEFAULT FALSE,
                is_muted BOOLEAN DEFAULT FALSE,
                UNIQUE(room_id, seat_number)
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS party_room_members (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                room_id UUID REFERENCES party_rooms(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL,
                role VARCHAR(50) DEFAULT 'listener',
                is_muted BOOLEAN DEFAULT FALSE,
                is_online BOOLEAN DEFAULT TRUE,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(room_id, user_id)
            )
        `);

        await db.query(`
            ALTER TABLE party_room_members ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE;
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS party_room_bans (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                room_id UUID REFERENCES party_rooms(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL,
                banned_by TEXT NOT NULL,
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NULL,
                is_active BOOLEAN DEFAULT TRUE,
                UNIQUE(room_id, user_id)
            )
        `);

        // Index creation for query optimizations
        await db.query('CREATE INDEX IF NOT EXISTS idx_party_rooms_host_id ON party_rooms(host_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_party_room_seats_room_id ON party_room_seats(room_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_party_room_members_lookup ON party_room_members(room_id, user_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_party_room_bans_lookup ON party_room_bans(room_id, user_id)');
        console.log('[DB] Party rooms, seats, members, and bans tables verified successfully!');
    } catch (err) {
        console.error('[DB-MIGRATION] Failed to create party tables:', err.message);
    }
}
ensurePartyTables();

// Lazy Socket.io integration hook using Express middleware
let socketInitialized = false;
router.use((req, res, next) => {
    const io = req.app.get('io');
    if (io && !socketInitialized) {
        io.on('connection', (socket) => {
            handlePartyRoomSockets(io, socket);
        });
        socketInitialized = true;
        console.log('📡 [SOCKET.IO] Party Room Socket Handlers mounted successfully!');
    }
    next();
});

// GET /api/party-rooms - List all active voice rooms
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT pr.*, u.display_name as host_name, u.avatar_url as host_avatar, u.vip_level as host_vip,
                   (
                       SELECT COUNT(DISTINCT user_id) 
                       FROM party_room_seats 
                       WHERE room_id = pr.id AND user_id IS NOT NULL
                   ) as active_speakers,
                   COALESCE((
                       SELECT json_agg(json_build_object('id', u2.id, 'avatar_url', u2.avatar_url))
                       FROM party_room_seats prs
                       JOIN users u2 ON prs.user_id = u2.id::text
                       WHERE prs.room_id = pr.id AND prs.user_id IS NOT NULL
                   ), '[]'::json) as participants
            FROM party_rooms pr
            LEFT JOIN users u ON pr.host_id = u.id::text
            ORDER BY pr.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('[API] Get party rooms error:', err.message);
        res.status(500).json({ error: 'Parti odaları listelenirken hata oluştu.' });
    }
});

// GET /api/party-rooms/:roomId - Get detail of a single voice room
router.get('/:roomId', authenticateToken, async (req, res) => {
    const { roomId } = req.params;
    try {
        const result = await db.query(`
            SELECT pr.*, u.display_name as host_name, u.avatar_url as host_avatar, u.vip_level as host_vip
            FROM party_rooms pr
            LEFT JOIN users u ON pr.host_id = u.id::text
            WHERE pr.id = $1
        `, [roomId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Parti odası bulunamadı.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[API] Get party room detail error:', err.message);
        res.status(500).json({ error: 'Parti odası bilgileri alınırken hata oluştu.' });
    }
});

// POST /api/party-rooms - Create a new voice room
router.post('/', authenticateToken, async (req, res) => {
    const { title, background_url, is_private, password, description, category, max_speakers } = req.body;
    const hostId = req.user.id;

    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Oda başlığı gereklidir.' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const maxSpeakers = parseInt(max_speakers) || 8;

        // 1. Insert room
        const roomRes = await client.query(`
            INSERT INTO party_rooms (title, host_id, background_url, is_private, password, description, category, max_speakers)
            VALUES ($1, $2::text, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            title.trim(), 
            hostId, 
            background_url || null, 
            is_private || false, 
            password || null, 
            description || null,
            category || 'Sohbet',
            maxSpeakers
        ]);

        const room = roomRes.rows[0];

        // 2. Pre-populate seats based on chosen max_speakers
        for (let seatNum = 1; seatNum <= maxSpeakers; seatNum++) {
            await client.query(`
                INSERT INTO party_room_seats (room_id, seat_number, user_id)
                VALUES ($1, $2, NULL)
            `, [room.id, seatNum]);
        }

        await client.query('COMMIT');
        res.json(room);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[API] Create party room error:', err.message);
        res.status(500).json({ error: 'Parti odası oluşturulamadı.' });
    } finally {
        client.release();
    }
});

// GET /api/party-rooms/:roomId/seats - Fetch seats details
router.get('/:roomId/seats', authenticateToken, async (req, res) => {
    const { roomId } = req.params;
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
        res.json(seatsRes.rows);
    } catch (err) {
        console.error('[API] Get seats error:', err.message);
        res.status(500).json({ error: 'Koltuk bilgisi alınamadı.' });
    }
});

// POST /api/party-rooms/:roomId/token - Generate RTC Token
router.post('/:roomId/token', authenticateToken, async (req, res) => {
    const { roomId } = req.params;
    try {
        const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
        const appId = process.env.AGORA_APP_ID || 'f80faf42fd0845a9816658ea7e16a755';
        const appCertificate = process.env.AGORA_APP_CERTIFICATE || 'e3361c06460541418754881b12bc3247';
        
        const channelName = `party_room_${roomId}`;
        
        // Agora classic RTC requires numerical UIDs.
        // We pass 0 so that it generates a token compatible with any numeric UID assigned by Agora.
        const uid = 0; 
        
        const expirationTimeInSeconds = 3600; // 1 hour
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
        
        const token = RtcTokenBuilder.buildTokenWithUid(
            appId,
            appCertificate,
            channelName,
            uid,
            RtcRole.PUBLISHER,
            privilegeExpiredTs
        );
        
        res.json({
            token,
            channelName,
            uid
        });
    } catch (err) {
        console.error('[Agora Token Generator] Error:', err);
        res.status(500).json({ error: 'Yayın anahtarı oluşturulamadı.' });
    }
});

// DELETE /api/party-rooms/:roomId - Delete room
router.delete('/:roomId', authenticateToken, async (req, res) => {
    const { roomId } = req.params;
    const userId = req.user.id;

    try {
        // Verify user is host or admin
        const checkRes = await db.query('SELECT host_id FROM party_rooms WHERE id = $1', [roomId]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({ error: 'Oda bulunamadı.' });
        }

        const hostId = checkRes.rows[0].host_id;
        const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

        if (hostId.toString() !== userId.toString() && !isAdmin) {
            return res.status(403).json({ error: 'Bu odayı silme yetkiniz yok.' });
        }

        // Delete room (cascade deletes seats)
        await db.query('DELETE FROM party_rooms WHERE id = $1', [roomId]);

        // Broadcast close event via socket
        const io = req.app.get('io');
        if (io) {
            io.to(`party_room_${roomId}`).emit('party_room_closed', { roomId });
        }

        res.json({ success: true, message: 'Oda başarıyla kapatıldı.' });
    } catch (err) {
        console.error('[API] Delete party room error:', err.message);
        res.status(500).json({ error: 'Oda kapatılamadı.' });
    }
});

// Helper to check caller privileges in a party room
async function checkPartyRoomModeratorPrivileges(roomId, callerId, callerRoleGlobal, targetUserId) {
    // 1. Fetch room details
    const roomRes = await db.query('SELECT host_id FROM party_rooms WHERE id = $1', [roomId]);
    if (roomRes.rows.length === 0) return { error: 'Oda bulunamadı.', status: 404 };
    
    const hostId = roomRes.rows[0].host_id;

    if (hostId.toString() === targetUserId.toString()) {
        return { error: 'Oda sahibi üzerinde moderasyon işlemi yapılamaz.', status: 403 };
    }

    if (callerId.toString() === targetUserId.toString()) {
        return { error: 'Kendiniz üzerinde moderasyon işlemi yapamazsınız.', status: 400 };
    }

    // 2. Fetch caller's and target's membership details
    const [callerMemberRes, targetMemberRes] = await Promise.all([
        db.query('SELECT role FROM party_room_members WHERE room_id = $1 AND user_id = $2::text', [roomId, callerId]),
        db.query('SELECT role FROM party_room_members WHERE room_id = $1 AND user_id = $2::text', [roomId, targetUserId])
    ]);

    const callerRoomRole = callerMemberRes.rows[0]?.role || 'listener';
    const targetRoomRole = targetMemberRes.rows[0]?.role || 'listener';

    const isCallerGlobalAdmin = ['admin', 'super_admin'].includes(callerRoleGlobal);
    const isCallerOwner = hostId.toString() === callerId.toString() || callerRoomRole === 'room_owner';
    const isCallerAdmin = callerRoomRole === 'room_admin' || isCallerGlobalAdmin;
    const isCallerMod = callerRoomRole === 'room_moderator';

    if (!isCallerOwner && !isCallerAdmin && !isCallerMod) {
        return { error: 'Bu işlem için yetkiniz bulunmuyor.', status: 403 };
    }

    // Rule: Room Moderator cannot manage owner, admin, or moderator
    if (isCallerMod && ['room_owner', 'room_admin', 'room_moderator'].includes(targetRoomRole)) {
        return { error: 'Moderatörler diğer yöneticileri yönetemez.', status: 403 };
    }

    // Rule: Room Admin cannot manage owner or other admins
    if (isCallerAdmin && !isCallerOwner && !isCallerGlobalAdmin && ['room_owner', 'room_admin'].includes(targetRoomRole)) {
        return { error: 'Adminler oda sahibini veya diğer adminleri yönetemez.', status: 403 };
    }

    return { success: true, isOwner: isCallerOwner, isGlobalAdmin: isCallerGlobalAdmin, callerRole: callerRoomRole };
}

// GET /api/party-rooms/:roomId/members - List members
router.get('/:roomId/members', authenticateToken, async (req, res) => {
    const { roomId } = req.params;
    const { query } = req.query;

    try {
        let sql = `
            SELECT prm.*, u.username, u.display_name, u.avatar_url, u.vip_level,
                   (SELECT seat_number FROM party_room_seats WHERE room_id = prm.room_id AND user_id = prm.user_id::text LIMIT 1) as seat_number
            FROM party_room_members prm
            JOIN users u ON prm.user_id = u.id::text
            WHERE prm.room_id = $1 AND prm.is_online = TRUE
        `;
        const params = [roomId];

        if (query && query.trim()) {
            sql += ` AND (u.username ILIKE $2 OR u.display_name ILIKE $2 OR prm.user_id ILIKE $2)`;
            params.push(`%${query.trim()}%`);
        }

        sql += ` ORDER BY 
            CASE 
                WHEN prm.role = 'room_owner' THEN 1
                WHEN prm.role = 'room_admin' THEN 2
                WHEN prm.role = 'room_moderator' THEN 3
                ELSE 4
            END ASC, prm.joined_at DESC`;

        const result = await db.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[API] Get party members error:', err.message);
        res.status(500).json({ error: 'Üyeler listelenirken hata oluştu.' });
    }
});

// GET /api/party-rooms/:roomId/banned - List banned users
router.get('/:roomId/banned', authenticateToken, async (req, res) => {
    const { roomId } = req.params;

    try {
        const result = await db.query(`
            SELECT prb.*, u.username, u.display_name, u.avatar_url, u2.username as banned_by_username
            FROM party_room_bans prb
            JOIN users u ON prb.user_id = u.id::text
            LEFT JOIN users u2 ON prb.banned_by = u2.id::text
            WHERE prb.room_id = $1 AND prb.is_active = TRUE
            ORDER BY prb.created_at DESC
        `, [roomId]);
        res.json(result.rows);
    } catch (err) {
        console.error('[API] Get party bans error:', err.message);
        res.status(500).json({ error: 'Yasaklılar listelenirken hata oluştu.' });
    }
});

// POST /api/party-rooms/:roomId/assign-role - Promote/Demote
router.post('/:roomId/assign-role', authenticateToken, async (req, res) => {
    const { roomId } = req.params;
    const { targetUserId, role } = req.body;
    const callerId = req.user.id;

    if (!targetUserId || !role) {
        return res.status(400).json({ error: 'Eksik parametre (targetUserId veya role).' });
    }

    if (!['room_admin', 'room_moderator', 'listener'].includes(role)) {
        return res.status(400).json({ error: 'Geçersiz rol. Sadece room_admin, room_moderator veya listener atanabilir.' });
    }

    const check = await checkPartyRoomModeratorPrivileges(roomId, callerId, req.user.role, targetUserId);
    if (check.error) {
        return res.status(check.status).json({ error: check.error });
    }

    if (!check.isOwner && !check.isGlobalAdmin) {
        return res.status(403).json({ error: 'Sadece oda sahibi veya global yöneticiler rol atayabilir.' });
    }

    try {
        const updateRes = await db.query(`
            UPDATE party_room_members
            SET role = $1
            WHERE room_id = $2 AND user_id = $3::text
            RETURNING *
        `, [role, roomId, targetUserId]);

        if (updateRes.rows.length === 0) {
            return res.status(400).json({ error: 'Kullanıcı odada aktif bulunmuyor.' });
        }

        const io = req.app.get('io');
        if (io) {
            io.to(`party_room_${roomId}`).emit('party_member_updated', {
                userId: targetUserId,
                role,
                action: 'role_changed'
            });
        }

        res.json({ success: true, message: `Kullanıcı rolü '${role}' olarak güncellendi.`, member: updateRes.rows[0] });
    } catch (err) {
        console.error('[API] Assign role error:', err.message);
        res.status(500).json({ error: 'Rol güncellenirken hata oluştu.' });
    }
});

// POST /api/party-rooms/:roomId/mute - Mute/Unmute member
router.post('/:roomId/mute', authenticateToken, async (req, res) => {
    const { roomId } = req.params;
    const { targetUserId, isMuted } = req.body;
    const callerId = req.user.id;

    if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId gereklidir.' });
    }

    const check = await checkPartyRoomModeratorPrivileges(roomId, callerId, req.user.role, targetUserId);
    if (check.error) {
        return res.status(check.status).json({ error: check.error });
    }

    try {
        const updateRes = await db.query(`
            UPDATE party_room_members
            SET is_muted = $1
            WHERE room_id = $2 AND user_id = $3::text
            RETURNING *
        `, [isMuted, roomId, targetUserId]);

        if (updateRes.rows.length === 0) {
            return res.status(400).json({ error: 'Kullanıcı odada bulunmuyor.' });
        }

        // If muted, turn off their mic if they are sitting on a seat
        if (isMuted) {
            const seatMuteRes = await db.query(`
                UPDATE party_room_seats
                SET is_muted = true
                WHERE room_id = $1 AND user_id = $2::text
                RETURNING seat_number
            `, [roomId, targetUserId]);

            if (seatMuteRes.rows.length > 0) {
                const io = req.app.get('io');
                if (io) {
                    io.to(`party_room_${roomId}`).emit('party_seat_mute_changed', {
                        seat_number: seatMuteRes.rows[0].seat_number,
                        is_muted: true,
                        user_id: targetUserId
                    });
                }
            }
        }

        const io = req.app.get('io');
        if (io) {
            io.to(`party_room_${roomId}`).emit('party_member_updated', {
                userId: targetUserId,
                is_muted: isMuted,
                action: 'mute_changed'
            });
        }

        res.json({ success: true, message: `Kullanıcı mikrofonu ${isMuted ? 'susturuldu' : 'açıldı'}.`, isMuted });
    } catch (err) {
        console.error('[API] Mute party member error:', err.message);
        res.status(500).json({ error: 'Mute işlemi sırasında hata oluştu.' });
    }
});

// POST /api/party-rooms/:roomId/kick - Kick member
router.post('/:roomId/kick', authenticateToken, async (req, res) => {
    const { roomId } = req.params;
    const { targetUserId } = req.body;
    const callerId = req.user.id;

    if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId gereklidir.' });
    }

    const check = await checkPartyRoomModeratorPrivileges(roomId, callerId, req.user.role, targetUserId);
    if (check.error) {
        return res.status(check.status).json({ error: check.error });
    }

    try {
        // Remove from members
        await db.query('DELETE FROM party_room_members WHERE room_id = $1 AND user_id = $2::text', [roomId, targetUserId]);

        // Vacate seat if occupied
        const seatRes = await db.query(`
            UPDATE party_room_seats
            SET user_id = NULL, is_muted = false
            WHERE room_id = $1 AND user_id = $2::text
            RETURNING seat_number
        `, [roomId, targetUserId]);

        const io = req.app.get('io');
        if (io) {
            io.to(`party_room_${roomId}`).emit('moderation:kicked', {
                roomId,
                targetUserId,
                reason: 'Moderatör tarafından odadan atıldınız.'
            });

            if (seatRes.rows.length > 0) {
                io.to(`party_room_${roomId}`).emit('party_seat_updated', {
                    seat_number: seatRes.rows[0].seat_number,
                    user_id: null,
                    username: null,
                    display_name: null,
                    avatar_url: null,
                    vip_level: 0,
                    is_muted: false
                });
            }
        }

        res.json({ success: true, message: 'Kullanıcı odadan başarıyla atıldı.' });
    } catch (err) {
        console.error('[API] Kick party member error:', err.message);
        res.status(500).json({ error: 'Kullanıcı atılırken hata oluştu.' });
    }
});

// POST /api/party-rooms/:roomId/ban - Ban member
router.post('/:roomId/ban', authenticateToken, async (req, res) => {
    const { roomId } = req.params;
    const { targetUserId, reason } = req.body;
    const callerId = req.user.id;

    if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId gereklidir.' });
    }

    const check = await checkPartyRoomModeratorPrivileges(roomId, callerId, req.user.role, targetUserId);
    if (check.error) {
        return res.status(check.status).json({ error: check.error });
    }

    if (check.callerRole === 'room_moderator') {
        return res.status(403).json({ error: 'Moderatörlerin kullanıcı yasaklama (ban) yetkisi yoktur.' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Upsert active ban record
        await client.query(`
            INSERT INTO party_room_bans (room_id, user_id, banned_by, reason, is_active)
            VALUES ($1, $2::text, $3::text, $4, TRUE)
            ON CONFLICT (room_id, user_id)
            DO UPDATE SET is_active = TRUE, banned_by = EXCLUDED.banned_by, reason = EXCLUDED.reason, created_at = CURRENT_TIMESTAMP
        `, [roomId, targetUserId, callerId, reason || 'Oda kurallarına uymama']);

        // Remove from members
        await client.query('DELETE FROM party_room_members WHERE room_id = $1 AND user_id = $2::text', [roomId, targetUserId]);

        // Vacate seat if occupied
        const seatRes = await client.query(`
            UPDATE party_room_seats
            SET user_id = NULL, is_muted = false
            WHERE room_id = $1 AND user_id = $2::text
            RETURNING seat_number
        `, [roomId, targetUserId]);

        await client.query('COMMIT');

        const io = client.app ? client.app.get('io') : req.app.get('io');
        if (io) {
            io.to(`party_room_${roomId}`).emit('moderation:kicked', {
                roomId,
                targetUserId,
                reason: 'Moderatör tarafından bu odadan yasaklandınız.'
            });

            if (seatRes.rows.length > 0) {
                io.to(`party_room_${roomId}`).emit('party_seat_updated', {
                    seat_number: seatRes.rows[0].seat_number,
                    user_id: null,
                    username: null,
                    display_name: null,
                    avatar_url: null,
                    vip_level: 0,
                    is_muted: false
                });
            }
        }

        res.json({ success: true, message: 'Kullanıcı odadan yasaklandı.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[API] Ban party member error:', err.message);
        res.status(500).json({ error: 'Kullanıcı yasaklanırken hata oluştu.' });
    } finally {
        client.release();
    }
});

// POST /api/party-rooms/:roomId/unban - Unban member
router.post('/:roomId/unban', authenticateToken, async (req, res) => {
    const { roomId } = req.params;
    const { targetUserId } = req.body;
    const callerId = req.user.id;

    if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId gereklidir.' });
    }

    const check = await checkPartyRoomModeratorPrivileges(roomId, callerId, req.user.role, targetUserId);
    if (check.error && check.status !== 403) { // It's okay if target user is not active member, check global authority
        return res.status(check.status).json({ error: check.error });
    }

    try {
        await db.query(`
            UPDATE party_room_bans
            SET is_active = FALSE
            WHERE room_id = $1 AND user_id = $2::text
        `, [roomId, targetUserId]);

        res.json({ success: true, message: 'Kullanıcının yasağı kaldırıldı.' });
    } catch (err) {
        console.error('[API] Unban party member error:', err.message);
        res.status(500).json({ error: 'Yasak kaldırılırken hata oluştu.' });
    }
});

module.exports = router;
