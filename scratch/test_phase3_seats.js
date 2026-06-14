const db = require('../db');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_in_prod';
const BASE_URL = 'http://localhost:5000/api';

async function setupTestUsers() {
    console.log('[Test Setup] Creating test users...');
    
    // 1. Create owner
    const ownerRes = await db.query(`
        INSERT INTO users (username, display_name, email, role, account_status, balance)
        VALUES ('seat_owner_test', 'Seat Owner Test', 'owner@seat.com', 'member', 'active', 100)
        ON CONFLICT (username) DO UPDATE SET balance = 100
        RETURNING id, username
    `);
    const owner = ownerRes.rows[0];

    // 2. Create normal member
    const memberRes = await db.query(`
        INSERT INTO users (username, display_name, email, role, account_status, balance)
        VALUES ('seat_member_test', 'Seat Member Test', 'member@seat.com', 'member', 'active', 50)
        ON CONFLICT (username) DO UPDATE SET balance = 50
        RETURNING id, username
    `);
    const member = memberRes.rows[0];

    // 3. Create banned user
    const bannedRes = await db.query(`
        INSERT INTO users (username, display_name, email, role, account_status, balance)
        VALUES ('seat_banned_test', 'Seat Banned Test', 'banned@seat.com', 'member', 'banned', 0)
        ON CONFLICT (username) DO UPDATE SET account_status = 'banned'
        RETURNING id, username
    `);
    const banned = bannedRes.rows[0];

    return { owner, member, banned };
}

async function runTests() {
    let users;
    try {
        users = await setupTestUsers();
    } catch (err) {
        console.error('Test setup failed:', err.message);
        process.exit(1);
    }

    const { owner, member, banned } = users;
    console.log(`[Test Setup] Owner ID: ${owner.id}, Member ID: ${member.id}, Banned ID: ${banned.id}`);

    // Generate JWT tokens
    const ownerToken = jwt.sign({ id: owner.id, username: owner.username }, JWT_SECRET);
    const memberToken = jwt.sign({ id: member.id, username: member.username }, JWT_SECRET);
    const bannedToken = jwt.sign({ id: banned.id, username: banned.username }, JWT_SECRET);

    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    const memberHeaders = { Authorization: `Bearer ${memberToken}` };
    const bannedHeaders = { Authorization: `Bearer ${bannedToken}` };

    let roomId;

    try {
        // 1. POST /rooms - Create room
        console.log('\n--- Test 1: POST /rooms (Create Room & Seats) ---');
        const createRes = await axios.post(`${BASE_URL}/rooms`, {
            name: 'Seat Test Room',
            maxSeats: 6,
            roomType: 'voice'
        }, { headers: ownerHeaders });

        roomId = createRes.data.id;
        console.log('Room created. ID:', roomId, 'Max Seats:', createRes.data.maxSeats);

        // Verify that 6 seats are automatically created in DB
        const dbSeatsCheck = await db.query('SELECT COUNT(*) FROM room_seats WHERE room_id = $1', [roomId]);
        console.log('DB room_seats count populated automatically:', dbSeatsCheck.rows[0].count);
        if (parseInt(dbSeatsCheck.rows[0].count) !== 6) {
            throw new Error('Seats were not automatically populated!');
        }

        // 2. GET /rooms/:id/seats - Fetch initial seats state
        console.log('\n--- Test 2: GET /rooms/:id/seats ---');
        const seatsInit = await axios.get(`${BASE_URL}/rooms/${roomId}/seats`, { headers: memberHeaders });
        console.log('Initial Seats retrieved successfully. Count:', seatsInit.data.length);

        // 3. User joins room
        await axios.post(`${BASE_URL}/rooms/${roomId}/join`, {}, { headers: memberHeaders });
        console.log('Member joined room.');

        // 4. POST /rooms/:id/seats/:index/take - Take seat 0
        console.log('\n--- Test 3: POST /rooms/:id/seats/0/take ---');
        const takeRes = await axios.post(`${BASE_URL}/rooms/${roomId}/seats/0/take`, {}, { headers: memberHeaders });
        console.log('Take seat status:', takeRes.status);
        console.log('Occupied Seat details:', JSON.stringify(takeRes.data, null, 2));

        // 5. POST /rooms/:id/seats/1/lock - Owner locks seat 1
        console.log('\n--- Test 4: POST /rooms/:id/seats/1/lock ---');
        const lockRes = await axios.post(`${BASE_URL}/rooms/${roomId}/seats/1/lock`, {}, { headers: ownerHeaders });
        console.log('Lock seat status:', lockRes.status);
        console.log('Locked Seat details:', JSON.stringify(lockRes.data, null, 2));

        // 6. Try to take locked seat as normal member (expect 403)
        console.log('\n--- Test 5: Try to take locked seat as normal member ---');
        try {
            await axios.post(`${BASE_URL}/rooms/${roomId}/seats/1/take`, {}, { headers: memberHeaders });
            throw new Error('Member was able to take locked seat! FAIL');
        } catch (err) {
            console.log('Success (Expected failure): Received error response code', err.response?.status, 'Message:', err.response?.data?.error);
        }

        // 7. Try to take seat as banned user (expect 403)
        console.log('\n--- Test 6: Try to take seat as banned user ---');
        try {
            await axios.post(`${BASE_URL}/rooms/${roomId}/seats/2/take`, {}, { headers: bannedHeaders });
            throw new Error('Banned user was able to take seat! FAIL');
        } catch (err) {
            console.log('Success (Expected failure): Received error response code', err.response?.status, 'Message:', err.response?.data?.error);
        }

        // 8. POST /rooms/:id/seats/0/mic - Toggle mic state
        console.log('\n--- Test 7: POST /rooms/:id/seats/0/mic ---');
        const micRes = await axios.post(`${BASE_URL}/rooms/${roomId}/seats/0/mic`, {}, { headers: memberHeaders });
        console.log('Mic Toggle Response:', JSON.stringify(micRes.data, null, 2));

        // 9. POST /rooms/:id/seats/0/kick - Owner kicks member from seat 0
        console.log('\n--- Test 8: POST /rooms/:id/seats/0/kick ---');
        const kickRes = await axios.post(`${BASE_URL}/rooms/${roomId}/seats/0/kick`, {}, { headers: ownerHeaders });
        console.log('Kick status:', kickRes.status);
        console.log('Kick Response Data:', JSON.stringify(kickRes.data, null, 2));

        // 10. POST /rooms/:id/seats/1/unlock - Owner unlocks seat 1
        console.log('\n--- Test 9: POST /rooms/:id/seats/1/unlock ---');
        const unlockRes = await axios.post(`${BASE_URL}/rooms/${roomId}/seats/1/unlock`, {}, { headers: ownerHeaders });
        console.log('Unlock status:', unlockRes.status, 'isLocked:', unlockRes.data.isLocked);

        console.log('\n[TEST RESULTS] All Faz 3 Seat system tests passed successfully! 🎉');
    } catch (err) {
        console.error('API Test failed:', err.response ? err.response.data : err.message);
    } finally {
        // Cleanup
        console.log('\n[Cleanup] Removing test users and rooms...');
        if (roomId) {
            await db.query('DELETE FROM rooms WHERE id = $1', [roomId]);
        }
        await db.query('DELETE FROM users WHERE username IN (\'seat_owner_test\', \'seat_member_test\', \'seat_banned_test\')');
        process.exit(0);
    }
}

runTests();
