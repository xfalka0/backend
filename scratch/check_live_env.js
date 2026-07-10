const axios = require('axios');
const jwt = require('jsonwebtoken');
const db = require('../db');

const LIVE_URL = 'http://localhost:5000/api';
const SECRET_KEY = 'falka_super_secret_2024_key_change_me';

async function testLiveRtc() {
    try {
        console.log("Fetching a real active user from the database...");
        const userRes = await db.query("SELECT id, username, role FROM users WHERE account_status = 'active' LIMIT 1");
        if (userRes.rows.length === 0) {
            console.error("No active user found in database!");
            process.exit(1);
        }
        const dbUser = userRes.rows[0];
        console.log("Using User:", dbUser.username, "(ID:", dbUser.id, ")");

        const token = jwt.sign({ 
            id: dbUser.id, 
            username: dbUser.username, 
            role: dbUser.role 
        }, SECRET_KEY);

        console.log("Fetching all party rooms from production...");
        const roomsRes = await axios.get(`${LIVE_URL}/party-rooms`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const rooms = roomsRes.data;
        if (!rooms || rooms.length === 0) {
            console.log("No active rooms found on production. Creating a temporary test room...");
            const createRes = await axios.post(`${LIVE_URL}/party-rooms`, {
                title: 'Agent RTC Temp Room',
                max_speakers: 8
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            rooms.push(createRes.data);
            console.log("Created temp room:", createRes.data.id);
        }

        const roomId = rooms[0].id;
        console.log(`Requesting RTC token for room ID: ${roomId}...`);
        
        const rtcRes = await axios.post(`${LIVE_URL}/rooms/${roomId}/rtc-token`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("Live RTC Token API Response:");
        console.log(JSON.stringify(rtcRes.data, null, 2));

        // Cleanup if we created a temp room
        if (rooms[0].title === 'Agent RTC Temp Room') {
            console.log("Cleaning up temp room...");
            await axios.delete(`${LIVE_URL}/party-rooms/${roomId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
        }
        
        process.exit(0);
    } catch (e) {
        console.error("Error connecting to production API:");
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", e.response.data);
        } else {
            console.error(e.message);
        }
        process.exit(1);
    }
}
testLiveRtc();
