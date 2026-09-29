require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const db = require('./db');

async function test() {
    try {
        const userRes = await db.query("SELECT * FROM users WHERE gender = 'erkek' AND role = 'user' LIMIT 1");
        const user = userRes.rows[0];
        const SECRET_KEY = process.env.JWT_SECRET || 'falka_super_secret_2024_key_change_me';
        const token = jwt.sign({ id: user.id, role: user.role, gender: user.gender }, SECRET_KEY);
        
        console.log('Testing discovery online tab as user:', user.id, user.gender, 'ON RENDER');
        
        const res = await axios.get('https://backend-kj17.onrender.com/api/discovery?tab=Çevrimiçi&page=1', {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('Discovery returned data:', res.data.length, 'users');
    } catch(e) {
        console.log('ERROR STATUS:', e.response?.status);
        console.log('ERROR DATA:', e.response?.data);
        console.log('ERROR MESSAGE:', e.message);
    }
    process.exit(0);
}
test();
