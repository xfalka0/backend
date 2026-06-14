const axios = require('axios');

async function testApi() {
    try {
        console.log('Testing live API...');
        const response = await axios.get('https://backend-kj17.onrender.com/api/social/explore?user_id=591');
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

testApi();
