const axios = require('axios');
require('dotenv').config();

async function checkSenders() {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        console.error('BREVO_API_KEY is not defined in .env!');
        return;
    }

    try {
        console.log('Querying Brevo verified senders list...');
        const response = await axios.get('https://api.brevo.com/v3/senders', {
            headers: {
                'api-key': apiKey
            }
        });
        console.log('SUCCESS!');
        console.log('Senders List:', JSON.stringify(response.data.senders, null, 2));
    } catch (err) {
        console.error('FAILED!');
        console.error('Error:', err.response?.data || err.message);
    }
}

checkSenders();
