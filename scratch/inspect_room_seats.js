const db = require('../db');

async function inspectSeats() {
    try {
        console.log("=== Active Party Rooms ===");
        const rooms = await db.query('SELECT id, title, host_id FROM party_rooms');
        console.table(rooms.rows);

        console.log("=== Active Seats ===");
        const seats = await db.query('SELECT id, room_id, seat_number, user_id, is_locked, is_muted FROM party_room_seats');
        console.table(seats.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
inspectSeats();
