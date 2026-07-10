const axios = require('axios');
const jwt = require('jsonwebtoken');
const { SECRET_KEY } = require('../middleware/auth');

async function testEndpoint() {
    const token = jwt.sign({ 
        id: 336, 
        username: 'alikarahasan981_2592', 
        role: 'user',
        gender: 'erkek'
    }, SECRET_KEY, { expiresIn: '30d' });

    try {
        const res = await axios.get('https://backend-kj17.onrender.com/api/users/336/chats?limit=20&offset=0', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = res.data;
        console.log('API RESPONSE SUCCESSFUL');
        console.log('Chats count:', data.length);
        if (data.length > 0) {
            console.log('Sample chat keys:', Object.keys(data[0]));
            console.log('Sample chat values:', data[0]);
        }
    } catch (e) {
        console.error('API CALL FAILED:', e.message);
    }
}

testEndpoint();
