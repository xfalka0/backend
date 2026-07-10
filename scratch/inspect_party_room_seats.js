const db = require('../db');

async function run() {
    try {
        const activeSeatsRes = await db.query("SELECT * FROM party_room_seats WHERE room_id = '326fb982-2646-416a-bfb4-8b0edd8b6abf'");
        console.log('All seats in active room 326fb982-2646-416a-bfb4-8b0edd8b6abf:');
        console.table(activeSeatsRes.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

run();
