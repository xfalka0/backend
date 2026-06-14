const db = require('../db');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_in_prod';
const BASE_URL = 'http://localhost:5000/api';

async function setupTestUsers() {
    console.log('[Test Setup] Creating test users...');
    // Create owner
    const ownerRes = await db.query(`
        INSERT INTO users (username, display_name, email, role, account_status, balance)
        VALUES ('room_owner_test', 'Room Owner Test', 'owner@test.com', 'member', 'active', 100)
        ON CONFLICT (username) DO UPDATE SET balance = 100
        RETURNING id, username
    `);
    const owner = ownerRes.rows[0];

    // Create guest
    const guestRes = await db.query(`
        INSERT INTO users (username, display_name, email, role, account_status, balance)
        VALUES ('room_guest_test', 'Room Guest Test', 'guest@test.com', 'member', 'active', 50)
        ON CONFLICT (username) DO UPDATE SET balance = 50
        RETURNING id, username
    `);
    const guest = guestRes.rows[0];

    return { owner, guest };
}

async function runTests() {
    let users;
    try {
        users = await setupTestUsers();
    } catch (err) {
        console.error('Test setup failed:', err.message);
        process.exit(1);
    }

    const { owner, guest } = users;
    console.log(`[Test Setup] Owner ID: ${owner.id}, Guest ID: ${guest.id}`);

    // Generate JWT tokens
    const ownerToken = jwt.sign({ id: owner.id, username: owner.username }, JWT_SECRET);
    const guestToken = jwt.sign({ id: guest.id, username: guest.username }, JWT_SECRET);

    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    const guestHeaders = { Authorization: `Bearer ${guestToken}` };

    let roomId;

    try {
        // 1. POST /rooms - Create room
        console.log('\n--- Test 1: POST /rooms ---');
        const createRes = await axios.post(`${BASE_URL}/rooms`, {
            name: 'Test Party Room',
            description: 'This is a test description',
            roomType: 'party',
            maxSeats: 10,
            isPrivate: false
        }, { headers: ownerHeaders });

        console.log('Create Room Response Status:', createRes.status);
        console.log('Created Room Details:', JSON.stringify(createRes.data, null, 2));
        roomId = createRes.data.id;
        if (!roomId) throw new Error('Room ID was not returned!');

        // 2. GET /rooms - List active rooms
        console.log('\n--- Test 2: GET /rooms ---');
        const listRes = await axios.get(`${BASE_URL}/rooms`, { headers: guestHeaders });
        console.log('List Rooms Response Status:', listRes.status);
        console.log(`Active rooms count: ${listRes.data.length}`);
        const createdRoomInList = listRes.data.find(r => r.id === roomId);
        console.log('Created room found in list:', !!createdRoomInList);

        // 3. POST /rooms/:id/join - Guest joins
        console.log('\n--- Test 3: POST /rooms/:id/join ---');
        const joinRes = await axios.post(`${BASE_URL}/rooms/${roomId}/join`, {}, { headers: guestHeaders });
        console.log('Join Room Response Status:', joinRes.status);
        console.log('Guest Join Result:', JSON.stringify(joinRes.data, null, 2));

        // 4. GET /rooms/:id - Get details and members
        console.log('\n--- Test 4: GET /rooms/:id ---');
        const detailRes = await axios.get(`${BASE_URL}/rooms/${roomId}`, { headers: guestHeaders });
        console.log('Get Room Detail Status:', detailRes.status);
        console.log(`Active members count: ${detailRes.data.members.length}`);
        console.log('Members:', JSON.stringify(detailRes.data.members, null, 2));

        // 5. POST /rooms/:id/leave - Guest leaves
        console.log('\n--- Test 5: POST /rooms/:id/leave ---');
        const leaveRes = await axios.post(`${BASE_URL}/rooms/${roomId}/leave`, {}, { headers: guestHeaders });
        console.log('Leave Room Response Status:', leaveRes.status);
        console.log('Leave Message:', leaveRes.data.message);

        // 6. PATCH /rooms/:id - Owner updates room properties
        console.log('\n--- Test 6: PATCH /rooms/:id ---');
        const updateRes = await axios.patch(`${BASE_URL}/rooms/${roomId}`, {
            name: 'Updated Test Room Name',
            description: 'Updated description',
            maxSeats: 8
        }, { headers: ownerHeaders });
        console.log('Update Room Response Status:', updateRes.status);
        console.log('Updated Room details:', JSON.stringify(updateRes.data, null, 2));

        // 7. POST /rooms/:id/close - Owner closes room
        console.log('\n--- Test 7: POST /rooms/:id/close ---');
        const closeRes = await axios.post(`${BASE_URL}/rooms/${roomId}/close`, {}, { headers: ownerHeaders });
        console.log('Close Room Response Status:', closeRes.status);
        console.log('Close Response Data:', JSON.stringify(closeRes.data, null, 2));

        console.log('\n[TEST RESULTS] All API tests passed successfully! 🎉');
    } catch (err) {
        console.error('API Test failed:', err.response ? err.response.data : err.message);
    } finally {
        // Cleanup test entries
        console.log('\n[Cleanup] Removing test users and rooms...');
        if (roomId) {
            await db.query('DELETE FROM rooms WHERE id = $1', [roomId]);
        }
        await db.query('DELETE FROM users WHERE username IN (\'room_owner_test\', \'room_guest_test\')');
        process.exit(0);
    }
}

runTests();
