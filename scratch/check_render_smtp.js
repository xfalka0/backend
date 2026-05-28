const axios = require('axios');

async function check() {
    try {
        console.log('1. Checking root URL (https://backend-kj17.onrender.com)...');
        const rootRes = await axios.get('https://backend-kj17.onrender.com', { timeout: 10000 });
        console.log('Root URL STATUS:', rootRes.status);
    } catch (err) {
        console.log('Root URL ERROR:', err.message);
    }

    try {
        console.log('2. Checking SMTP diagnostics endpoint...');
        const res = await axios.get('https://backend-kj17.onrender.com/api/auth/smtp-diagnostics', { timeout: 15000 });
        console.log('Diagnostics STATUS:', res.status);
        console.log('Diagnostics DATA:', res.data);
    } catch (err) {
        console.log('Diagnostics ERROR STATUS:', err.response?.status);
        console.log('Diagnostics ERROR DATA:', err.response?.data || err.message);
    }
}

check();
