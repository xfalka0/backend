const { io } = require('../mobile-app/node_modules/socket.io-client');
const jwt = require('jsonwebtoken');
const db = require('../db');

const LIVE_SOCKET_URL = 'https://backend-kj17.onrender.com';
const SECRET_KEY = 'falka_super_secret_2024_key_change_me';

async function testSeatSwitching() {
    try {
        console.log("Fetching a real active user from the database...");
        const userRes = await db.query("SELECT id, username FROM users WHERE account_status = 'active' LIMIT 1");
        if (userRes.rows.length === 0) {
            console.error("No active users found.");
            process.exit(1);
        }
        const user = userRes.rows[0];
        console.log(`Using User: ${user.username} (ID: ${user.id})`);

        // Generate token
        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY);

        console.log("Fetching a party room from database...");
        const roomRes = await db.query("SELECT id, title FROM party_rooms LIMIT 1");
        if (roomRes.rows.length === 0) {
            console.error("No party rooms found.");
            process.exit(1);
        }
        const room = roomRes.rows[0];
        console.log(`Using Room: ${room.title} (ID: ${room.id})`);

        console.log(`Connecting to Live Socket: ${LIVE_SOCKET_URL}`);
        const socket = io(LIVE_SOCKET_URL, {
            transports: ['websocket'],
            auth: { token }
        });

        let step = 0;

        socket.on('connect', () => {
            console.log("Connected to live Socket.io server successfully!");
            socket.emit('join_party_room', { roomId: room.id });
        });

        socket.on('user_joined_party', (data) => {
            if (data.userId === user.id) {
                console.log("Joined room. Step 1: Requesting seat 1...");
                socket.emit('request_seat', { roomId: room.id, seatNumber: 1 });
            }
        });

        socket.on('party_seat_updated', (data) => {
            console.log(`Event: party_seat_updated [Seat ${data.seat_number}] user_id: ${data.user_id}`);
            
            if (data.user_id === user.id) {
                if (data.seat_number === 1 && step === 0) {
                    step = 1;
                    console.log("Successfully sat on Seat 1. Step 2: Switching to Seat 2...");
                    socket.emit('request_seat', { roomId: room.id, seatNumber: 2 });
                } else if (data.seat_number === 2 && step === 1) {
                    step = 2;
                    console.log("Successfully switched to Seat 2. Step 3: Switching to Seat 3...");
                    socket.emit('request_seat', { roomId: room.id, seatNumber: 3 });
                } else if (data.seat_number === 3 && step === 2) {
                    console.log("SUCCESS: Seat switching sequence completed with no errors!");
                    socket.disconnect();
                    process.exit(0);
                }
            }
        });

        socket.on('party_room_error', (data) => {
            console.log("Event: party_room_error received:", data);
            socket.disconnect();
            process.exit(1);
        });

        socket.on('connect_error', (err) => {
            console.error("Connection error:", err.message);
            process.exit(1);
        });

        // Timeout after 15 seconds
        setTimeout(() => {
            console.error("Timeout waiting for seat switching events. Current step:", step);
            socket.disconnect();
            process.exit(1);
        }, 15000);

    } catch (e) {
        console.error("Script error:", e);
        process.exit(1);
    }
}
testSeatSwitching();
