const axios = require('axios');

async function testVerify() {
    try {
        console.log('Testing live verify-otp for furkandn011@gmail.com with code 345444...');
        const res = await axios.post('https://backend-kj17.onrender.com/api/auth/verify-otp', {
            email: 'furkandn011@gmail.com',
            code: '345444',
            deviceId: 'test-device-id'
        });

        console.log('SUCCESS!');
        console.log('STATUS:', res.status);
        console.log('DATA:', res.data);
    } catch (err) {
        console.log('FAILED!');
        console.log('ERROR STATUS:', err.response?.status);
        console.log('ERROR DATA:', err.response?.data || err.message);
    }
}

testVerify();
