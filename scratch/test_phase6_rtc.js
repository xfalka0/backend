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
        VALUES ('rtc_owner_test', 'RTC Owner Test', 'owner@rtc.com', 'member', 'active', 100)
        ON CONFLICT (username) DO UPDATE SET balance = 100
        RETURNING id, username
    `);
    const owner = ownerRes.rows[0];

    // Create normal member
    const memberRes = await db.query(`
        INSERT INTO users (username, display_name, email, role, account_status, balance)
        VALUES ('rtc_member_test', 'RTC Member Test', 'member@rtc.com', 'member', 'active', 100)
        ON CONFLICT (username) DO UPDATE SET balance = 100
        RETURNING id, username
    `);
    const member = memberRes.rows[0];

    return { owner, member };
}

async function runTests() {
    let testData;
    try {
        testData = await setupTestUsers();
    } catch (err) {
        console.error('Test setup failed:', err.message);
        process.exit(1);
    }

    const { owner, member } = testData;
    const ownerToken = jwt.sign({ id: owner.id, username: owner.username }, JWT_SECRET);
    const memberToken = jwt.sign({ id: member.id, username: member.username }, JWT_SECRET);

    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    const memberHeaders = { Authorization: `Bearer ${memberToken}` };

    let roomId;

    try {
        // 1. Owner creates a room
        const roomCreate = await axios.post(`${BASE_URL}/rooms`, {
            name: 'RTC Test Room',
            maxSeats: 4,
            roomType: 'voice'
        }, { headers: ownerHeaders });
        roomId = roomCreate.data.id;
        console.log(`[HTTP Setup] Created room. ID: ${roomId}`);

        // Member joins the room
        await axios.post(`${BASE_URL}/rooms/${roomId}/join`, {}, { headers: memberHeaders });
        console.log('[Setup] Member joined room.');

        // 2. Fetch RTC token for Owner (expected role: 'host')
        console.log('\n--- Test 1: Fetch RTC token for Owner (Host Role) ---');
        const ownerRtcRes = await axios.post(`${BASE_URL}/rooms/${roomId}/rtc-token`, {}, { headers: ownerHeaders });
        console.log('Owner Token details:', JSON.stringify(ownerRtcRes.data, null, 2));
        if (ownerRtcRes.data.role !== 'host') {
            throw new Error(`Owner role mismatch! Expected 'host', got: ${ownerRtcRes.data.role}`);
        }

        // 3. Fetch RTC token for Member NOT on a seat (expected role: 'listener')
        console.log('\n--- Test 2: Fetch RTC token for Member off a seat (Listener Role) ---');
        const listenerRtcRes = await axios.post(`${BASE_URL}/rooms/${roomId}/rtc-token`, {}, { headers: memberHeaders });
        console.log('Listener Member Token details:', JSON.stringify(listenerRtcRes.data, null, 2));
        if (listenerRtcRes.data.role !== 'listener') {
            throw new Error(`Member role mismatch! Expected 'listener', got: ${listenerRtcRes.data.role}`);
        }

        // 4. Member takes seat 0
        console.log('\n--- Test Setup: Member takes seat 0 ---');
        await axios.post(`${BASE_URL}/rooms/${roomId}/seats/0/take`, {}, { headers: memberHeaders });
        console.log('Member successfully occupied seat 0.');

        // 5. Fetch RTC token for Member sitting on a seat (expected role: 'speaker')
        console.log('\n--- Test 3: Fetch RTC token for Member on a seat (Speaker Role) ---');
        const speakerRtcRes = await axios.post(`${BASE_URL}/rooms/${roomId}/rtc-token`, {}, { headers: memberHeaders });
        console.log('Speaker Member Token details:', JSON.stringify(speakerRtcRes.data, null, 2));
        if (speakerRtcRes.data.role !== 'speaker') {
            throw new Error(`Member role mismatch! Expected 'speaker', got: ${speakerRtcRes.data.role}`);
        }

        // 6. Test Agora provider dynamically
        console.log('\n--- Test 4: Testing Agora Token Generator directly ---');
        const { AgoraRtcProvider } = require('../utils/rtcProvider');
        const agoraProvider = new AgoraRtcProvider();
        const agoraToken = await agoraProvider.createJoinToken(owner.id, roomId, 'host');
        console.log('Generated Agora Token length:', agoraToken.length);
        if (!agoraToken || agoraToken.length < 10) {
            throw new Error('Agora Provider token generation failed!');
        }

        console.log('\n[TEST RESULTS] Phase 6 Voice / RTC Altyapısı tests passed successfully! 🎉');

    } catch (err) {
        console.error('RTC API Test failed:', err.response ? err.response.data : err.message);
    } finally {
        // Cleanup
        console.log('\n[Cleanup] Removing test users and rooms...');
        if (roomId) {
            await db.query('DELETE FROM rooms WHERE id = $1', [roomId]);
        }
        await db.query('DELETE FROM users WHERE username IN (\'rtc_owner_test\', \'rtc_member_test\')');
        // Reset provider env
        delete process.env.RTC_PROVIDER;
        process.exit(0);
    }
}

runTests();
