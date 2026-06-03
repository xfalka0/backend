const axios = require('axios');

async function testVerify() {
    try {
        const res = await axios.post('https://backend-kj17.onrender.com/api/auth/verify-otp', {
            email: 'furkandn012@gmail.com',
            code: '112233'
        });
        console.log('API Response:', res.data);
    } catch (err) {
        console.error('API Error Status:', err.response?.status);
        console.error('API Error Data:', err.response?.data);
    }
}

testVerify();
