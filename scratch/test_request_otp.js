const axios = require('axios');

async function testRequest() {
    try {
        console.log('Sending request-otp API call to Render...');
        const res = await axios.post('https://backend-kj17.onrender.com/api/auth/request-otp', {
            email: 'furkandn012@gmail.com'
        });
        console.log('API Response:', res.data);
    } catch (err) {
        console.error('API Error Status:', err.response?.status);
        console.error('API Error Data:', err.response?.data);
    }
}

testRequest();
