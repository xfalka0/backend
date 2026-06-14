const db = require('../db');
require('../routes/partyRooms');

async function runTest() {
    console.log('=== STARTING VOICE PARTY ROOM SYSTEM INTEGRATION TEST ===\n');
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Verify schema tables exist
        console.log('[Test] Verifying tables exist in schema...');
        const tableCheck = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_name IN ('party_rooms', 'party_room_seats')
        `);
        console.log(`Found ${tableCheck.rows.length} tables in DB:`, tableCheck.rows.map(r => r.table_name));
        if (tableCheck.rows.length < 2) {
            throw new Error('Missing party_rooms or party_room_seats tables in database!');
        }

        // 2. Create a test user (host)
        console.log('[Test] Creating mock host user...');
        const hostRes = await client.query(`
            INSERT INTO users (username, email, role, gender, display_name, balance)
            VALUES ('test_host_' || gen_random_uuid()::text, 'host@test.com', 'user', 'kadin', 'Oda Yoneticisi', 1000)
            RETURNING id, username
        `);
        const host = hostRes.rows[0];
        console.log(`Created Host: ${host.username} (ID: ${host.id})`);

        // 3. Create a test user (participant)
        console.log('[Test] Creating mock participant user...');
        const participantRes = await client.query(`
            INSERT INTO users (username, email, role, gender, display_name, balance)
            VALUES ('test_user_' || gen_random_uuid()::text, 'participant@test.com', 'user', 'erkek', 'Katilimci Arda', 500)
            RETURNING id, username
        `);
        const participant = participantRes.rows[0];
        console.log(`Created Participant: ${participant.username} (ID: ${participant.id})`);

        // 4. Create a party room
        console.log('\n[Test] Simulating creating a voice party room...');
        const roomRes = await client.query(`
            INSERT INTO party_rooms (title, host_id, background_url, is_private)
            VALUES ('Cilveli Kizlar - Sohbet Partisi', $1::text, 'http://test.url/bg.png', false)
            RETURNING *
        `, [host.id]);
        const room = roomRes.rows[0];
        console.log(`Created Room: "${room.title}" (ID: ${room.id})`);

        // 5. Pre-populate seats for the room
        console.log('[Test] Populating 8 seats for the room...');
        for (let seatNum = 1; seatNum <= 8; seatNum++) {
            await client.query(`
                INSERT INTO party_room_seats (room_id, seat_number, user_id)
                VALUES ($1, $2, NULL)
            `, [room.id, seatNum]);
        }
        console.log('✅ Pre-populated 8 seats successfully.');

        // 6. Test taking seat 1 (for participant)
        console.log('\n--- Simulation Case 1: Participant takes Seat 3 ---');
        await client.query(`
            UPDATE party_room_seats 
            SET user_id = $1::text 
            WHERE room_id = $2 AND seat_number = 3
        `, [participant.id, room.id]);

        let seats = await client.query('SELECT * FROM party_room_seats WHERE room_id = $1 ORDER BY seat_number', [room.id]);
        console.log('Current Seat Allocations:');
        seats.rows.forEach(s => {
            if (s.user_id) {
                console.log(`  - Seat ${s.seat_number}: OCCUPIED by User ID: ${s.user_id}`);
            } else {
                console.log(`  - Seat ${s.seat_number}: Empty`);
            }
        });

        // 7. Test Muting/Unmuting Seat 3
        console.log('\n--- Simulation Case 2: Host mutes Seat 3 ---');
        await client.query(`
            UPDATE party_room_seats 
            SET is_muted = true 
            WHERE room_id = $1 AND seat_number = 3
        `, [room.id]);
        
        let seat3 = await client.query('SELECT is_muted FROM party_room_seats WHERE room_id = $1 AND seat_number = 3', [room.id]);
        console.log(`Seat 3 is muted: ${seat3.rows[0].is_muted}`);

        // 8. Test Locking Seat 5
        console.log('\n--- Simulation Case 3: Host locks Seat 5 ---');
        await client.query(`
            UPDATE party_room_seats 
            SET is_locked = true 
            WHERE room_id = $1 AND seat_number = 5
        `, [room.id]);

        let seat5 = await client.query('SELECT is_locked FROM party_room_seats WHERE room_id = $1 AND seat_number = 5', [room.id]);
        console.log(`Seat 5 is locked: ${seat5.rows[0].is_locked}`);

        console.log('\n=== TEST COMPLETED SUCCESSFULLY! ===');
        await client.query('ROLLBACK'); // Transaction rollback to keep DB clean
        console.log('[Test] Changes rolled back. DB is clean.');
    } catch (e) {
        console.error('\n❌ TEST FAILED WITH ERROR:', e);
        try {
            await client.query('ROLLBACK');
            console.log('[Test] Rolled back after failure.');
        } catch (rollbackErr) {
            console.error('Failed to rollback:', rollbackErr);
        }
    } finally {
        client.release();
    }
}

runTest();
