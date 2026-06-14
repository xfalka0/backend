const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const db = require('../db');
const axios = require('axios');

const SECRET_KEY = process.env.JWT_SECRET || 'falka_super_secret_2024_key_change_me';
const SERVER_URL = 'http://localhost:5000';

async function runSimulation() {
    console.log('--- STARTING SOCKET SIMULATION SCENARIO ---');

    // Trigger lazy socket registration in the backend
    try {
        await axios.get(`${SERVER_URL}/api/party-rooms`);
    } catch (e) {
        // Ignore auth error, we just want to mount the socket handlers
    }
    
    // 1. Fetch User A & User B
    const userARes = await db.query("SELECT id, username, role, account_status, balance FROM users WHERE username = 'testuser'");
    const userBRes = await db.query("SELECT id, username, role, account_status, balance FROM users WHERE username = 'rich_guy'");
    
    const userA = userARes.rows[0];
    const userB = userBRes.rows[0];
    
    console.log(`User A: ${userA.username} (${userA.id}), Coins: ${userA.balance}`);
    console.log(`User B: ${userB.username} (${userB.id}), Coins: ${userB.balance}`);
    
    // Reset User A balance to 100 for testing
    await db.query("UPDATE users SET balance = 100 WHERE id = $1", [userA.id]);
    userA.balance = 100;
    
    // 2. Sign JWT Tokens
    const tokenA = jwt.sign({ id: userA.id, username: userA.username, role: userA.role }, SECRET_KEY);
    const tokenB = jwt.sign({ id: userB.id, username: userB.username, role: userB.role }, SECRET_KEY);
    
    // 3. Create a Staging Room and seats in database
    await db.query("DELETE FROM party_rooms WHERE host_id = $1::text", [userA.id]);
    const roomRes = await db.query("INSERT INTO party_rooms (title, host_id) VALUES ('Simulation Staging Room', $1) RETURNING id", [userA.id]);
    const roomId = roomRes.rows[0].id;
    console.log(`Created Room ID: ${roomId}`);
    
    for (let i = 1; i <= 8; i++) {
        await db.query("INSERT INTO party_room_seats (room_id, seat_number, user_id) VALUES ($1, $2, NULL)", [roomId, i]);
    }
    
    const report = [];
    const logStep = (stepName, expected, result, note = '') => {
        report.push({ Step: stepName, Expected: expected, Result: result, Note: note });
        console.log(`[Step] ${stepName} | Expected: ${expected} | Result: ${result} | Note: ${note}`);
    };
    
    // Step 1: User A Login & Connection
    let clientA, clientB;
    try {
        clientA = io(SERVER_URL, { auth: { token: tokenA }, forceNew: true });
        await new Promise((resolve, reject) => {
            clientA.on('connect', resolve);
            clientA.on('connect_error', reject);
            setTimeout(() => reject(new Error('Timeout connecting User A')), 3000);
        });
        logStep('User A Login & Socket Connect', 'Connects successfully', 'GEÇTİ');
    } catch (err) {
        logStep('User A Login & Socket Connect', 'Connects successfully', 'KALDI', err.message);
        process.exit(1);
    }
    
    // Step 2: User B Login & Connection
    try {
        clientB = io(SERVER_URL, { auth: { token: tokenB }, forceNew: true });
        await new Promise((resolve, reject) => {
            clientB.on('connect', resolve);
            clientB.on('connect_error', reject);
            setTimeout(() => reject(new Error('Timeout connecting User B')), 3000);
        });
        logStep('User B Login & Socket Connect', 'Connects successfully', 'GEÇTİ');
    } catch (err) {
        logStep('User B Login & Socket Connect', 'Connects successfully', 'KALDI', err.message);
        process.exit(1);
    }
    
    // Step 3: User A join room
    try {
        clientA.emit('join_party_room', { roomId });
        const seatsState = await new Promise((resolve) => {
            clientA.once('party_seats_state', resolve);
        });
        logStep('User A joins room', 'Joins and gets seat state', 'GEÇTİ', `Seat count: ${seatsState.length}`);
    } catch (err) {
        logStep('User A joins room', 'Joins and gets seat state', 'KALDI', err.message);
    }
    
    // Step 4: User B joins same room
    try {
        clientB.emit('join_party_room', { roomId });
        const joinEvent = await new Promise((resolve) => {
            clientA.once('user_joined_party', resolve);
        });
        logStep('User B joins same room', 'User A sees User B join event', 'GEÇTİ', `Joined user: ${joinEvent.username}`);
    } catch (err) {
        logStep('User B joins same room', 'User A sees User B join event', 'KALDI', err.message);
    }
    
    // Step 5: User A request seat 1
    try {
        clientA.emit('request_seat', { roomId, seatNumber: 1 });
        const seatUpdate = await new Promise((resolve) => {
            clientB.once('party_seat_updated', resolve);
        });
        if (seatUpdate.seat_number === 1 && seatUpdate.user_id === userA.id) {
            logStep('User A sits on Seat 1', 'Seat 1 updated with User A', 'GEÇTİ');
        } else {
            logStep('User A sits on Seat 1', 'Seat 1 updated with User A', 'KALDI', 'Mismatch seat update info');
        }
    } catch (err) {
        logStep('User A sits on Seat 1', 'Seat 1 updated with User A', 'KALDI', err.message);
    }
    
    // Step 6: User B sends chat message
    try {
        const testMsg = 'Hello from User B!';
        clientB.emit('send_party_message', { roomId, content: testMsg });
        const msgRecv = await new Promise((resolve) => {
            clientA.once('receive_party_message', resolve);
        });
        if (msgRecv.content === testMsg && msgRecv.sender.id === userB.id) {
            logStep('User B sends chat message', 'User A receives it realtime', 'GEÇTİ', `Content: "${msgRecv.content}"`);
        } else {
            logStep('User B sends chat message', 'User A receives it realtime', 'KALDI', 'Content or sender mismatch');
        }
    } catch (err) {
        logStep('User B sends chat message', 'User A receives it realtime', 'KALDI', err.message);
    }
    
    // Step 7: User A sends gift to User B
    const idempotencyKey = 'simulated-key-' + Date.now();
    try {
        // Gift id 1 (Rose) costs 50 (or 10 in seed.js; Gül cost is 50 in existing DB)
        // Let's query gift cost from DB first to be 100% accurate
        const giftRes = await db.query("SELECT id, name, cost FROM gifts WHERE id = 1");
        const gift = giftRes.rows[0] || { id: 1, name: 'Gül', cost: 50 };
        console.log(`Sending gift: ${gift.name} (ID: ${gift.id}, Cost: ${gift.cost})`);

        clientA.emit('send_party_gift', { 
            roomId, 
            targetUserId: userB.id, 
            giftId: gift.id, 
            idempotencyKey 
        });

        // Wait for gift_success on User A and party_gift_sent on User B
        const [successA, broadcastB] = await Promise.all([
            new Promise((resolve) => clientA.once('gift_success', resolve)),
            new Promise((resolve) => clientB.once('party_gift_sent', resolve))
        ]);

        // Check new balance
        const balanceRes = await db.query("SELECT balance FROM users WHERE id = $1", [userA.id]);
        const finalBalance = balanceRes.rows[0].balance;
        const expectedBalance = 100 - gift.cost;

        if (successA.duplicate === false && broadcastB.gift_id === gift.id && finalBalance === expectedBalance) {
            logStep('User A sends Gift to B', 'Gift succeeds, coins deducted, event broadcasted', 'GEÇTİ', `A balance: ${finalBalance}`);
        } else {
            logStep('User A sends Gift to B', 'Gift succeeds, coins deducted, event broadcasted', 'KALDI', `Duplicate: ${successA.duplicate}, Bal: ${finalBalance}`);
        }
    } catch (err) {
        logStep('User A sends Gift to B', 'Gift succeeds, coins deducted, event broadcasted', 'KALDI', err.message);
    }
    
    // Step 8: Retrying with same idempotencyKey
    try {
        clientA.emit('send_party_gift', { 
            roomId, 
            targetUserId: userB.id, 
            giftId: 1, 
            idempotencyKey 
        });

        const retryResult = await new Promise((resolve) => clientA.once('gift_success', resolve));
        
        // Check balance again
        const balanceRes = await db.query("SELECT balance FROM users WHERE id = $1", [userA.id]);
        const finalBalance = balanceRes.rows[0].balance;

        if (retryResult.duplicate === true && finalBalance === (100 - 50)) { // Gül costs 50
            logStep('Retry same IdempotencyKey', 'Rejected as duplicate, balance unchanged', 'GEÇTİ');
        } else {
            logStep('Retry same IdempotencyKey', 'Rejected as duplicate, balance unchanged', 'KALDI', `Duplicate: ${retryResult.duplicate}, Bal: ${finalBalance}`);
        }
    } catch (err) {
        logStep('Retry same IdempotencyKey', 'Rejected as duplicate, balance unchanged', 'KALDI', err.message);
    }

    // Step 9: User B disconnects
    try {
        clientB.disconnect();
        // Wait briefly for server cleanup
        await new Promise((resolve) => setTimeout(resolve, 500));
        logStep('User B Disconnects', 'User B socket disconnected', 'GEÇTİ');
    } catch (err) {
        logStep('User B Disconnects', 'User B socket disconnected', 'KALDI', err.message);
    }

    // Step 10: User B reconnects and joins again
    try {
        clientB = io(SERVER_URL, { auth: { token: tokenB }, forceNew: true });
        await new Promise((resolve) => clientB.once('connect', resolve));
        
        clientB.emit('join_party_room', { roomId });
        const seatsState = await new Promise((resolve) => clientB.once('party_seats_state', resolve));
        
        const seat1 = seatsState.find(s => s.seat_number === 1);
        if (seat1 && seat1.user_id === userA.id) {
            logStep('User B Reconnects & gets state', 'State returned with A still on seat 1', 'GEÇTİ');
        } else {
            logStep('User B Reconnects & gets state', 'State returned with A still on seat 1', 'KALDI', 'Seat 1 is empty or has wrong user');
        }
    } catch (err) {
        logStep('User B Reconnects & gets state', 'State returned with A still on seat 1', 'KALDI', err.message);
    }

    // Disconnect clients
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();

    // Clean up
    await db.query("DELETE FROM party_room_seats WHERE room_id = $1", [roomId]);
    await db.query("DELETE FROM party_rooms WHERE id = $1", [roomId]);
    console.log('Room cleaned up.');

    console.log('\n--- SIMULATION COMPLETED ---');
    console.table(report);
    process.exit(0);
}

runSimulation().catch(err => {
    console.error('Fatal simulation error:', err);
    process.exit(1);
});
