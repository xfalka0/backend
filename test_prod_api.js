const axios = require('axios');

async function test() {
    try {
        console.log('Testing /api/operators...');
        const res = await axios.get('https://backend-kj17.onrender.com/api/operators?limit=1');
        console.log('Success:', res.data);
    } catch (err) {
        console.log('Error Status:', err.response?.status);
        console.log('Error Data:', JSON.stringify(err.response?.data, null, 2));
    }
}

test();
