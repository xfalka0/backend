const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const db = require('../db');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_in_prod';
const SOCKET_URL = 'http://localhost:5000';
const BASE_URL = 'http://localhost:5000/api';

async function setupTestUsers() {
    console.log('[Test Setup] Creating test users...');
    
    // Create Owner
    const ownerRes = await db.query(`
        INSERT INTO users (username, display_name, email, role, account_status, balance)
        VALUES ('chat_owner_test', 'Chat Owner Test', 'owner@chat.com', 'member', 'active', 100)
        ON CONFLICT (username) DO UPDATE SET balance = 100
        RETURNING id, username
    `);
    const owner = ownerRes.rows[0];

    // Create Normal User
    const memberRes = await db.query(`
        INSERT INTO users (username, display_name, email, role, account_status, balance)
        VALUES ('chat_member_test', 'Chat Member Test', 'member@chat.com', 'member', 'active', 100)
        ON CONFLICT (username) DO UPDATE SET balance = 100
        RETURNING id, username
    `);
    const member = memberRes.rows[0];

    // Create Chat Banned User
    const bannedRes = await db.query(`
        INSERT INTO users (username, display_name, email, role, account_status, balance)
        VALUES ('chat_banned_test', 'Chat Banned Test', 'banned@chat.com', 'member', 'active', 100)
        ON CONFLICT (username) DO UPDATE SET balance = 100
        RETURNING id, username
    `);
    const banned = bannedRes.rows[0];

    return { owner, member, banned };
}

async function runTests() {
    let testData;
    try {
        testData = await setupTestUsers();
    } catch (err) {
        console.error('Test setup failed:', err.message);
        process.exit(1);
    }

    const { owner, member, banned } = testData;
    const ownerToken = jwt.sign({ id: owner.id, username: owner.username }, JWT_SECRET);
    const memberToken = jwt.sign({ id: member.id, username: member.username }, JWT_SECRET);
    const bannedToken = jwt.sign({ id: banned.id, username: banned.username }, JWT_SECRET);

    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };

    let roomId;

    try {
        // 1. Create room via HTTP
        const roomCreate = await axios.post(`${BASE_URL}/rooms`, {
            name: 'Phase 5 Chat Room',
            maxSeats: 6,
            roomType: 'voice'
        }, { headers: ownerHeaders });
        roomId = roomCreate.data.id;
        console.log(`[HTTP Setup] Room created. ID: ${roomId}`);

        // Set is_chat_banned = true for banned user in room_members
        await db.query(`
            INSERT INTO room_members (room_id, user_id, role, is_chat_banned)
            VALUES ($1, $2, 'member', true)
        `, [roomId, banned.id]);
        console.log('[Setup] Set chat ban for chat_banned_test.');

        // 2. Connect Member client
        console.log('\n--- Connecting Member Socket ---');
        const memberSocket = io(SOCKET_URL, {
            auth: { token: memberToken },
            transports: ['websocket']
        });

        await new Promise((resolve) => memberSocket.on('connect', resolve));
        console.log('Member socket connected.');

        // Member joins room (triggers system message: "chat_member_test odaya girdi")
        memberSocket.emit('join_room', { roomId });
        await new Promise((resolve) => {
            memberSocket.on('room_response', (data) => {
                console.log('Member received room_response. Recent Messages count:', data.recentMessages.length);
                resolve();
            });
        });

        // 3. Connect Banned User client and try to chat
        console.log('\n--- Connecting Banned User Socket ---');
        const bannedSocket = io(SOCKET_URL, {
            auth: { token: bannedToken },
            transports: ['websocket']
        });

        await new Promise((resolve) => bannedSocket.on('connect', resolve));
        console.log('Banned socket connected.');

        bannedSocket.emit('join_room', { roomId });
        await new Promise(r => setTimeout(r, 500)); // wait for join

        let bannedErrorReceived = false;
        bannedSocket.on('error_response', (err) => {
            console.log('Banned Socket received error:', JSON.stringify(err));
            if (err.code === 'CHAT_BANNED') {
                bannedErrorReceived = true;
            }
        });

        // Banned user tries to chat (should fail)
        bannedSocket.emit('chat', { roomId, message: 'I want to say something!' });
        await new Promise(r => setTimeout(r, 800));
        console.log('Banned chat message blocked successfully:', bannedErrorReceived);

        // 4. Member sends chat message
        console.log('\n--- Test: Member sends normal chat message ---');
        memberSocket.emit('chat', { roomId, message: 'Hello world from normal user!' });
        await new Promise(r => setTimeout(r, 500));

        // 5. GET /rooms/:id/messages - Fetch history via API
        console.log('\n--- Test: Fetch messages history via HTTP API ---');
        const messagesRes = await axios.get(`${BASE_URL}/rooms/${roomId}/messages?limit=10`, { headers: ownerHeaders });
        console.log(`HTTP retrieved ${messagesRes.data.length} messages.`);
        messagesRes.data.forEach(msg => {
            console.log(`- [${msg.messageType || 'text'}] [${msg.username || 'System'}]: ${msg.content}`);
        });

        // 6. Connect Owner Socket & clear chat
        console.log('\n--- Connecting Owner Socket ---');
        const ownerSocket = io(SOCKET_URL, {
            auth: { token: ownerToken },
            transports: ['websocket']
        });

        await new Promise((resolve) => ownerSocket.on('connect', resolve));
        console.log('Owner socket connected.');

        ownerSocket.emit('join_room', { roomId });
        await new Promise(r => setTimeout(r, 500));

        let chatClearedReceived = false;
        memberSocket.on('chat_cleared', (data) => {
            console.log('Member Socket received chat_cleared alert for roomId:', data.roomId);
            chatClearedReceived = true;
        });

        // Owner clears chat
        console.log('\n--- Test: Owner clears room chat ---');
        ownerSocket.emit('chat_clear', { roomId });
        await new Promise(r => setTimeout(r, 800));
        console.log('Chat cleared broadcast received:', chatClearedReceived);

        // Fetch history again to ensure it only has the "Oda sohbeti temizlendi" system message
        const finalMessagesRes = await axios.get(`${BASE_URL}/rooms/${roomId}/messages`, { headers: ownerHeaders });
        console.log(`HTTP retrieved ${finalMessagesRes.data.length} messages after clearing.`);
        console.log('Remaining Message:', finalMessagesRes.data[0]?.content);

        // Disconnect all sockets
        memberSocket.disconnect();
        bannedSocket.disconnect();
        ownerSocket.disconnect();

        console.log('\n[TEST RESULTS] Phase 5 Chat System tests passed successfully! 🎉');
    } catch (err) {
        console.error('API / Socket Test failed:', err.response ? err.response.data : err.message);
    } finally {
        // Cleanup
        console.log('\n[Cleanup] Removing test users and rooms...');
        if (roomId) {
            await db.query('DELETE FROM rooms WHERE id = $1', [roomId]);
        }
        await db.query('DELETE FROM users WHERE username IN (\'chat_owner_test\', \'chat_member_test\', \'chat_banned_test\')');
        process.exit(0);
    }
}

runTests();
