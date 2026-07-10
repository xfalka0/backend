const { io } = require('../mobile-app/node_modules/socket.io-client');
const jwt = require('jsonwebtoken');
const db = require('../db');

const LIVE_SOCKET_URL = 'https://backend-kj17.onrender.com';
const SECRET_KEY = 'falka_super_secret_2024_key_change_me';

async function testLiveSockets() {
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

        socket.on('connect', () => {
            console.log("Connected to live Socket.io server successfully!");
            
            console.log(`Sending join_party_room for room: ${room.id}`);
            socket.emit('join_party_room', { roomId: room.id });
        });

        socket.on('user_joined_party', (data) => {
            console.log("Event: user_joined_party received:", data);
            
            // Try to request seat 1
            console.log("Sending request_seat for seat 1...");
            socket.emit('request_seat', { roomId: room.id, seatNumber: 1 });
        });

        socket.on('party_seat_updated', (data) => {
            console.log("Event: party_seat_updated received:", data);
            socket.disconnect();
            process.exit(0);
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
            console.error("Timeout waiting for socket events.");
            socket.disconnect();
            process.exit(1);
        }, 15000);

    } catch (e) {
        console.error("Script error:", e);
        process.exit(1);
    }
}
testLiveSockets();
