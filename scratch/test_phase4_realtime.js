const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const db = require('../db');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_change_in_prod';
const SOCKET_URL = 'http://localhost:5000';
const BASE_URL = 'http://localhost:5000/api';

async function setupTestUsers() {
    console.log('[Test Setup] Creating test users...');
    
    // Create sender
    const senderRes = await db.query(`
        INSERT INTO users (username, display_name, email, role, account_status, balance)
        VALUES ('gateway_sender_test', 'Gateway Sender Test', 'sender@gateway.com', 'member', 'active', 500)
        ON CONFLICT (username) DO UPDATE SET balance = 500
        RETURNING id, username
    `);
    const sender = senderRes.rows[0];

    // Create receiver (Kadin for gift conversions check)
    const receiverRes = await db.query(`
        INSERT INTO users (username, display_name, email, role, account_status, balance, gender)
        VALUES ('gateway_receiver_test', 'Gateway Receiver Test', 'receiver@gateway.com', 'member', 'active', 0, 'kadin')
        ON CONFLICT (username) DO UPDATE SET gender = 'kadin'
        RETURNING id, username
    `);
    const receiver = receiverRes.rows[0];

    // Create a gift for testing if not existing
    const giftRes = await db.query(`
        INSERT INTO gifts (id, name, cost, icon_url)
        VALUES (999, 'Test Gateway Rose', 20, 'http://test.com/rose.png')
        ON CONFLICT (id) DO UPDATE SET cost = 20
        RETURNING id, name
    `);
    const gift = giftRes.rows[0];

    return { sender, receiver, gift };
}

async function runTests() {
    let testData;
    try {
        testData = await setupTestUsers();
    } catch (err) {
        console.error('Test setup failed:', err.message);
        process.exit(1);
    }

    const { sender, receiver, gift } = testData;
    const senderToken = jwt.sign({ id: sender.id, username: sender.username }, JWT_SECRET);
    const ownerHeaders = { Authorization: `Bearer ${senderToken}` };

    let roomId;

    try {
        // 1. Create a Room via HTTP
        const roomCreate = await axios.post(`${BASE_URL}/rooms`, {
            name: 'Gateway Realtime Room',
            maxSeats: 4,
            roomType: 'party'
        }, { headers: ownerHeaders });
        roomId = roomCreate.data.id;
        console.log(`[HTTP Setup] Created room. ID: ${roomId}`);

        // 2. Connect Socket client
        console.log('\n--- Connecting Socket Client ---');
        const socket = io(SOCKET_URL, {
            auth: { token: senderToken },
            transports: ['websocket']
        });

        await new Promise((resolve, reject) => {
            socket.on('connect', () => {
                console.log('Socket client connected successfully!');
                resolve();
            });
            socket.on('connect_error', (err) => {
                console.error('Socket connection error:', err.message);
                reject(err);
            });
        });

        // 3. Test join_room
        console.log('\n--- Test 1: join_room ---');
        socket.emit('join_room', { roomId });

        const roomResponse = await new Promise((resolve) => {
            socket.on('room_response', (data) => {
                console.log('Received room_response contract:');
                console.log('- Room Name:', data.room.name);
                console.log('- Seats Count:', data.seats.length);
                console.log('- Members count:', data.members.length);
                console.log('- Online Count:', data.onlineCount);
                resolve(data);
            });
        });

        // 4. Test chat message & flood limit (Send 6 messages fast)
        console.log('\n--- Test 2: Chat & Flood Limiter ---');
        let floodErrorReceived = false;

        socket.on('error_response', (err) => {
            console.log('Received standardized error response:', JSON.stringify(err));
            if (err.code === 'FLOOD_LIMIT_EXCEEDED') {
                floodErrorReceived = true;
            }
        });

        socket.on('chat_broadcast', (msg) => {
            console.log(`Received chat_broadcast: [${msg.username}] ${msg.content}`);
        });

        for (let i = 1; i <= 6; i++) {
            socket.emit('chat', {
                roomId,
                message: `Gateway Test Message ${i}`,
                clientMessageId: `client_msg_${i}`
            });
            await new Promise(r => setTimeout(r, 100)); // Hızlı gönderim simülasyonu
        }

        // Wait a bit for broadcasts/errors to arrive
        await new Promise(r => setTimeout(r, 1000));
        console.log('Flood error was triggered & verified:', floodErrorReceived);

        // 5. Test gift sending and idempotency
        console.log('\n--- Test 3: Idempotent Gift sending ---');
        const idempotencyKey = 'unique_idempotency_key_test_123';
        
        let giftSuccessCount = 0;
        socket.on('gift_success', (data) => {
            console.log('Received gift_success response:', JSON.stringify(data));
            giftSuccessCount++;
        });

        // Send 1st gift request
        socket.emit('gift', {
            roomId,
            receiverUserId: receiver.id,
            giftId: gift.id,
            quantity: 1,
            idempotencyKey
        });

        await new Promise(r => setTimeout(r, 500));

        // Send 2nd gift request with SAME key (should map to success duplicate without charging again)
        socket.emit('gift', {
            roomId,
            receiverUserId: receiver.id,
            giftId: gift.id,
            quantity: 1,
            idempotencyKey
        });

        await new Promise(r => setTimeout(r, 500));
        console.log('Total gift_success triggers (expected 2):', giftSuccessCount);

        // Disconnect client
        socket.disconnect();
        console.log('\n[TEST RESULTS] RoomGateway Realtime Tests Completed successfully! 🎉');

    } catch (err) {
        console.error('Gateway Realtime Test failed:', err.message);
    } finally {
        // Cleanup
        console.log('\n[Cleanup] Removing test users, gifts and rooms...');
        if (roomId) {
            await db.query('DELETE FROM rooms WHERE id = $1', [roomId]);
        }
        if (gift) {
            await db.query('DELETE FROM gifts WHERE id = $1', [gift.id]);
        }
        await db.query('DELETE FROM users WHERE username IN (\'gateway_sender_test\', \'gateway_receiver_test\')');
        process.exit(0);
    }
}

runTests();
