const axios = require('axios');

async function testOtp() {
  const url = 'https://backend-kj17.onrender.com/api/auth/request-otp';
  const email = 'furkandn012@gmail.com';
  console.log(`Sending POST to ${url} for email: ${email}...`);
  try {
    const res = await axios.post(url, { email });
    console.log('Response Status:', res.status);
    console.log('Response Data:', res.data);
  } catch (err) {
    console.error('Error occurred:');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Headers:', err.response.headers);
      console.error('Data:', err.response.data);
    } else {
      console.error('Message:', err.message);
    }
  }
}

testOtp();
