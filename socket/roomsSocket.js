const db = require('../db');

function handleRoomsSockets(io, socket) {
    // 1. JOIN ROOM SYSTEM (Places client in socket room and sends initial seat state)
    socket.on('join_room_system', async (data) => {
        const { roomId } = data;
        if (!roomId) return;

        const roomName = `room_${roomId}`;
        socket.join(roomName);
        console.log(`[SOCKET] User ${socket.user?.username || socket.id} joined room system: ${roomName}`);

        try {
            const seatsRes = await db.query(`
                SELECT rs.*, u.username, u.display_name, u.avatar_url
                FROM room_seats rs
                LEFT JOIN users u ON rs.user_id = u.id
                WHERE rs.room_id = $1
                ORDER BY rs.seat_index ASC
            `, [roomId]);
            
            socket.emit('seats_state', seatsRes.rows.map(row => ({
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
                username: row.username,
                displayName: row.display_name,
                display_name: row.display_name,
                avatarUrl: row.avatar_url,
                avatar_url: row.avatar_url
            })));
        } catch (err) {
            console.error('[SOCKET] Error sending initial seats state:', err.message);
        }
    });

    // 2. LEAVE ROOM SYSTEM
    socket.on('leave_room_system', (data) => {
        const { roomId } = data;
        if (!roomId) return;

        const roomName = `room_${roomId}`;
        socket.leave(roomName);
        console.log(`[SOCKET] User ${socket.user?.username || socket.id} left room system: ${roomName}`);
    });
}

module.exports = { handleRoomsSockets };
