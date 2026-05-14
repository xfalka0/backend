const axios = require('axios');
const API_URL = 'https://backend-kj17.onrender.com/api';

async function checkOperators() {
    try {
        console.log('Fetching operators...');
        const res = await axios.get(`${API_URL}/operators?limit=100`);
        const targetNames = ['Hasan', 'Karadayı', 'Adabi60', 'İhsan', 'affiliate1'];
        const found = res.data.filter(op => targetNames.some(name => op.name.includes(name)));
        console.log(JSON.stringify(found.map(op => ({ name: op.name, gender: op.gender, role: op.role })), null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkOperators();
