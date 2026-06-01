const axios = require('axios');

const BASE_URL = 'https://backend-kj17.onrender.com';
const email = 'furkandn012@gmail.com';

async function testOtp() {
    console.log('--- TESTING OTP GENERATION AND VERIFICATION ---');
    try {
        console.log(`1. Requesting OTP for ${email}...`);
        const reqRes = await axios.post(`${BASE_URL}/api/auth/request-otp`, { email });
        console.log('OTP Request Response:', reqRes.data);

        if (!reqRes.data.success) {
            console.log('Failed to request OTP!');
            return;
        }

        const otp = reqRes.data.dev_otp;
        console.log(`Retrieved dev_otp: ${otp}`);

        console.log(`2. Verifying OTP ${otp} for ${email}...`);
        const verifyRes = await axios.post(`${BASE_URL}/api/auth/verify-otp`, {
            email,
            code: otp,
            deviceId: 'test_device_id'
        });
        console.log('OTP Verify Response status:', verifyRes.status);
        console.log('OTP Verify Response:', verifyRes.data);

    } catch (err) {
        console.error('Error occurred during test:');
        if (err.response) {
            console.error(`Status: ${err.response.status}`);
            console.error('Data:', err.response.data);
        } else {
            console.error(err.message);
        }
    }
}

testOtp();
