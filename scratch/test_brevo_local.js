const axios = require('axios');
require('dotenv').config();

async function testBrevo() {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        console.error('BREVO_API_KEY is not defined in .env!');
        return;
    }

    console.log('Sending test email via Brevo HTTP API...');
    try {
        const response = await axios.post('https://api.brevo.com/v3/smtp/email', {
            sender: { name: 'Fiva Test', email: 'falkasoft@gmail.com' },
            to: [{ email: 'falkasoft@gmail.com' }],
            subject: 'Fiva Brevo API Test',
            htmlContent: `
                <html>
                <body>
                    <h2>Brevo API Key Doğrulaması Başarılı!</h2>
                    <p>Fiva uygulamasından gönderilen bu test e-postası, Brevo API anahtarınızın sorunsuz çalıştığını kanıtlar.</p>
                    <p>Zaman damgası: ${new Date().toISOString()}</p>
                </body>
                </html>
            `
        }, {
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json'
            }
        });

        console.log('SUCCESS!');
        console.log('Response Status:', response.status);
        console.log('Response Data:', response.data);
    } catch (err) {
        console.error('FAILED!');
        console.error('Error Status:', err.response?.status);
        console.error('Error Data:', JSON.stringify(err.response?.data || err.message, null, 2));
    }
}

testBrevo();
