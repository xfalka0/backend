const axios = require('axios');

async function checkLocal() {
    try {
        const res = await axios.get('http://localhost:5000/api/health');
        console.log('Local Server is RUNNING! Response:', res.data);
    } catch (err) {
        console.log('Local Server is NOT running or failed. Error:', err.message);
    }
}

checkLocal();
