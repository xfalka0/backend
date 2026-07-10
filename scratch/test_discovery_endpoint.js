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
        const res = await axios.get('https://backend-kj17.onrender.com/api/discovery?tab=Önerilen&page=1&limit=20', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = res.data;
        console.log('API RESPONSE SUCCESSFUL');
        const targets = ['belinaays', 'Azroşş', 'Asyaa'];
        const matched = data.filter(op => targets.some(t => op.name.includes(t)));
        matched.forEach(op => {
            console.log(`\nOperator: ${op.name}`);
            console.log(`Avatar URL: ${op.avatar_url}`);
            console.log(`Avatar: ${op.avatar}`);
            console.log(`Photos:`, op.photos);
        });
    } catch (e) {
        console.error('API CALL FAILED:', e.message);
    }
}

testEndpoint();
