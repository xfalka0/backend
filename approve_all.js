const axios = require('axios');

const API_URL = 'https://backend-kj17.onrender.com/api';
const EMAIL = 'admin@falka.com';
const PASS = 'admin123';

async function approveAll() {
    try {
        console.log('Logging in...');
        const loginRes = await axios.post(`${API_URL}/login`, { email: EMAIL, password: PASS });
        const token = loginRes.data.token;
        console.log('Logged in. Token:', token.substring(0, 10) + '...');

        console.log('Fetching pending photos...');
        const pendingRes = await axios.get(`${API_URL}/moderation/pending`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const photos = pendingRes.data;
        console.log(`Found ${photos.length} pending photos.`);

        for (const p of photos) {
            console.log(`Approving Photo ID: ${p.id} (User: ${p.username})`);
            await axios.post(`${API_URL}/moderation/approve`, { photoId: p.id }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Approved!');
        }
        console.log('All done.');

    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

approveAll();
