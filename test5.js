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
        
        console.log('Testing auth/me on Render as user:', user.id);
        const res = await axios.get('https://backend-kj17.onrender.com/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Auth Me returned:', Object.keys(res.data));
        console.log('Has gender_confirmed_at?', 'gender_confirmed_at' in res.data);
    } catch(e) {
        console.log('ERROR:', e.message);
    }
    process.exit(0);
}
test();
