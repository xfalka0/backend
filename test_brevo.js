const axios = require('axios');
require('dotenv').config();

async function testBrevo() {
  const apiKey = process.env.BREVO_API_KEY;
  console.log('Using API Key:', apiKey ? apiKey.substring(0, 15) + '...' : 'MISSING');
  
  try {
    const res = await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: { name: 'Fiva Test', email: 'fdnsmn00@gmail.com' },
      to: [{ email: 'furkandn012@gmail.com' }],
      subject: 'Fiva Brevo Test',
      htmlContent: '<p>This is a test email from Brevo integration.</p>'
    }, {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    console.log('Success!', res.status, res.data);
  } catch (error) {
    console.error('Error sending via Brevo:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
    }
  }
}

testBrevo();
