const db = require('../db');

async function run() {
    try {
        const columnsRes = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'party_room_members'
        `);
        console.log('Columns of party_room_members:');
        console.table(columnsRes.rows);

        const columnsSeats = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'party_room_seats'
        `);
        console.log('Columns of party_room_seats:');
        console.table(columnsSeats.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

run();
