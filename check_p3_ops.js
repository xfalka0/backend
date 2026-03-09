const axios = require('axios');

async function run() {
    try {
        const API_URL = 'https://backend-kj17.onrender.com/api';
        console.log('Fetching operators from:', API_URL);
        const res = await axios.get(`${API_URL}/operators?limit=1000`);
        const ops = res.data;

        console.log(`Total Operators: ${ops.length}`);

        const page3 = ops.slice(20, 30);
        console.log('--- PAGE 3 OPERATORS ---');
        console.log(JSON.stringify(page3, null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    }
}

run();
