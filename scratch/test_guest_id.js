const axios = require('axios');

async function testGuestId() {
    try {
        console.log('Testing live API with guest UUID...');
        const response = await axios.get('https://backend-kj17.onrender.com/api/social/explore?user_id=c917f7d6-cc44-4b04-8917-1dbbed0b1e9b');
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error('API call failed!');
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        } else {
            console.error('Error message:', err.message);
        }
    }
}

testGuestId();
