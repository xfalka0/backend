const axios = require('axios');

async function testEndpoints() {
    try {
        console.log('Testing /api/social/explore...');
        const exploreRes = await axios.get('https://backend-kj17.onrender.com/api/social/explore?user_id=591');
        console.log('/api/social/explore status:', exploreRes.status);
    } catch (e) {
        console.error('/api/social/explore failed:', e.message);
    }

    try {
        console.log('Testing /api/operators?limit=100...');
        const operatorsRes = await axios.get('https://backend-kj17.onrender.com/api/operators?limit=100');
        console.log('/api/operators status:', operatorsRes.status);
        console.log('Operators count:', operatorsRes.data ? operatorsRes.data.length : 0);
    } catch (e) {
        console.error('/api/operators failed:', e.message);
        if (e.response) {
            console.error('Response status:', e.response.status);
            console.error('Response data:', e.response.data);
        }
    }
}

testEndpoints();
