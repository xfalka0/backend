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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
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

        // Index creation for query optimizations
        await db.query('CREATE INDEX IF NOT EXISTS idx_party_rooms_host_id ON party_rooms(host_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_party_room_seats_room_id ON party_room_seats(room_id)');
        console.log('[DB] Party rooms and seats tables verified successfully!');
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

// POST /api/party-rooms - Create a new voice room
router.post('/', authenticateToken, async (req, res) => {
    const { title, background_url, is_private, password } = req.body;
    const hostId = req.user.id;

    if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Oda başlığı gereklidir.' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Insert room
        const roomRes = await client.query(`
            INSERT INTO party_rooms (title, host_id, background_url, is_private, password)
            VALUES ($1, $2::text, $3, $4, $5)
            RETURNING *
        `, [title.trim(), hostId, background_url || null, is_private || false, password || null]);

        const room = roomRes.rows[0];

        // 2. Pre-populate 16 seats for the room
        for (let seatNum = 1; seatNum <= 16; seatNum++) {
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
            SELECT prs.*, u.username, u.display_name, u.avatar_url, u.vip_level
            FROM party_room_seats prs
            LEFT JOIN users u ON prs.user_id = u.id::text
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

module.exports = router;
