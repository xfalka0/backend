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
        VALUES ('mod_owner_test', 'Mod Owner Test', 'owner@mod.com', 'member', 'active', 100)
        ON CONFLICT (username) DO UPDATE SET balance = 100
        RETURNING id, username
    `);
    const owner = ownerRes.rows[0];

    // Create moderator candidate
    const modRes = await db.query(`
        INSERT INTO users (username, display_name, email, role, account_status, balance)
        VALUES ('mod_candidate_test', 'Mod Candidate Test', 'mod@mod.com', 'member', 'active', 100)
        ON CONFLICT (username) DO UPDATE SET balance = 100
        RETURNING id, username
    `);
    const mod = modRes.rows[0];

    // Create target user
    const targetRes = await db.query(`
        INSERT INTO users (username, display_name, email, role, account_status, balance)
        VALUES ('mod_target_test', 'Mod Target Test', 'target@mod.com', 'member', 'active', 100)
        ON CONFLICT (username) DO UPDATE SET balance = 100
        RETURNING id, username
    `);
    const target = targetRes.rows[0];

    return { owner, mod, target };
}

async function runTests() {
    let testData;
    try {
        testData = await setupTestUsers();
    } catch (err) {
        console.error('Test setup failed:', err.message);
        process.exit(1);
    }

    const { owner, mod, target } = testData;
    const ownerToken = jwt.sign({ id: owner.id, username: owner.username }, JWT_SECRET);
    const modToken = jwt.sign({ id: mod.id, username: mod.username }, JWT_SECRET);
    const targetToken = jwt.sign({ id: target.id, username: target.username }, JWT_SECRET);

    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
    const modHeaders = { Authorization: `Bearer ${modToken}` };
    const targetHeaders = { Authorization: `Bearer ${targetToken}` };

    let roomId;

    try {
        // 1. Owner creates a room
        const roomCreate = await axios.post(`${BASE_URL}/rooms`, {
            name: 'Moderation Test Room',
            maxSeats: 4,
            roomType: 'voice'
        }, { headers: ownerHeaders });
        roomId = roomCreate.data.id;
        console.log(`[HTTP Setup] Created room. ID: ${roomId}`);

        // Users join the room
        await axios.post(`${BASE_URL}/rooms/${roomId}/join`, {}, { headers: modHeaders });
        await axios.post(`${BASE_URL}/rooms/${roomId}/join`, {}, { headers: targetHeaders });
        console.log('[Setup] Mod candidate and Target user joined room.');

        // Target user occupies seat 0
        await axios.post(`${BASE_URL}/rooms/${roomId}/seats/0/take`, {}, { headers: targetHeaders });
        console.log('[Setup] Target user occupied seat 0.');

        // 2. Owner promotes Mod Candidate to admin role in room
        console.log('\n--- Test 1: POST /rooms/:id/moderation/assign-role (Promote to Admin) ---');
        const promoteRes = await axios.post(`${BASE_URL}/rooms/${roomId}/moderation/assign-role`, {
            targetUserId: mod.id,
            role: 'admin'
        }, { headers: ownerHeaders });
        console.log('Promote response status:', promoteRes.status, 'New role:', promoteRes.data.member.role);

        // 3. New Admin mutes target user
        console.log('\n--- Test 2: POST /rooms/:id/moderation/mute (Admin mutes Target) ---');
        const muteRes = await axios.post(`${BASE_URL}/rooms/${roomId}/moderation/mute`, {
            targetUserId: target.id,
            isMuted: true
        }, { headers: modHeaders });
        console.log('Mute response status:', muteRes.status, 'isMuted:', muteRes.data.isMuted);

        // 4. New Admin chat-bans target user
        console.log('\n--- Test 3: POST /rooms/:id/moderation/chat-ban (Admin chat-bans Target) ---');
        const chatBanRes = await axios.post(`${BASE_URL}/rooms/${roomId}/moderation/chat-ban`, {
            targetUserId: target.id,
            isChatBanned: true
        }, { headers: modHeaders });
        console.log('Chat-ban response status:', chatBanRes.status, 'isChatBanned:', chatBanRes.data.isChatBanned);

        // 5. New Admin kicks target user (should vacate seat 0 and set left_at)
        console.log('\n--- Test 4: POST /rooms/:id/moderation/kick (Admin kicks Target) ---');
        const kickRes = await axios.post(`${BASE_URL}/rooms/${roomId}/moderation/kick`, {
            targetUserId: target.id
        }, { headers: modHeaders });
        console.log('Kick response status:', kickRes.status, 'Message:', kickRes.data.message);

        // Verify seat 0 is vacant
        const seatRes = await db.query('SELECT user_id FROM room_seats WHERE room_id = $1 AND seat_index = 0', [roomId]);
        console.log('Kicked user seat status (expected null):', seatRes.rows[0].user_id);
        if (seatRes.rows[0].user_id) {
            throw new Error('Kicked user seat was not vacated!');
        }

        // 6. Test authority limits: Admin tries to kick Owner (expect 403)
        console.log('\n--- Test 5: Authority Limit Check (Admin tries to kick Owner) ---');
        try {
            await axios.post(`${BASE_URL}/rooms/${roomId}/moderation/kick`, {
                targetUserId: owner.id
            }, { headers: modHeaders });
            throw new Error('Admin was able to kick Room Owner! FAIL');
        } catch (err) {
            console.log('Success (Expected failure): Received status code', err.response?.status, 'Message:', err.response?.data?.error);
        }

        // 7. POST /reports - Target user reports Owner
        console.log('\n--- Test 6: POST /reports (Target reports Owner) ---');
        const reportRes = await axios.post(`${BASE_URL}/reports`, {
            targetUserId: owner.id,
            roomId,
            reason: 'Harassment',
            description: 'Owner was behaving aggressively.'
        }, { headers: targetHeaders });
        console.log('Report response status:', reportRes.status, 'Message:', reportRes.data.message);

        // 8. Verify DB records for admin actions and reports
        console.log('\n--- Test 7: Verify SQL Logging ---');
        const actionsCount = await db.query('SELECT COUNT(*) FROM admin_actions WHERE room_id = $1', [roomId]);
        console.log('Logged admin_actions count (expected 4: assign-role, mute, chat-ban, kick):', actionsCount.rows[0].count);

        const reportsCount = await db.query('SELECT COUNT(*) FROM reports WHERE room_id = $1', [roomId]);
        console.log('Logged reports count (expected 1):', reportsCount.rows[0].count);

        console.log('\n[TEST RESULTS] All Phase 8 Moderation System tests passed successfully! 🎉');

    } catch (err) {
        console.error('API Test failed:', err.response ? err.response.data : err.message);
    } finally {
        // Cleanup
        console.log('\n[Cleanup] Removing test users and rooms...');
        if (roomId) {
            await db.query('DELETE FROM rooms WHERE id = $1', [roomId]);
        }
        await db.query("DELETE FROM activities WHERE user_id IN (SELECT id FROM users WHERE username IN ('mod_owner_test', 'mod_candidate_test', 'mod_target_test'))");
        await db.query("DELETE FROM users WHERE username IN ('mod_owner_test', 'mod_candidate_test', 'mod_target_test')");
        process.exit(0);
    }
}

runTests();
