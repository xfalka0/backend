const axios = require('axios');

async function run() {
    try {
        const API_URL = 'https://backend-kj17.onrender.com/api';
        console.log('Fetching operators from:', API_URL);
        const res = await axios.get(`${API_URL}/operators?limit=1000`);
        const ops = res.data;

        console.log(`Total Operators: ${ops.length}`);

        const missingPhotos = ops.filter(op => !op.avatar_url || op.avatar_url.includes('placeholder') || !op.photos || op.photos.length === 0);

        console.log('--- OPERATORS WITH MISSING/PLACEHOLDER PHOTOS ---');
        missingPhotos.forEach(op => {
            console.log(`ID: ${op.id}, Name: ${op.name}, Avatar: ${op.avatar_url}, Photos: ${JSON.stringify(op.photos)}`);
        });

        console.log('--- SAMPLE OF ALL OPERATORS (Top 5) ---');
        console.log(JSON.stringify(ops.slice(0, 5), null, 2));

    } catch (err) {
        console.error('Error:', err.message);
    }
}

run();
