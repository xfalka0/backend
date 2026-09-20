require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const jwt = require('jsonwebtoken');

async function testDilek() {
    try {
        const adminRes = await pool.query("SELECT id, role FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1");
        const admin = adminRes.rows[0];
        const token = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET || 'fiva_secret_key_2024!_#');

        const putRes = await axios.put('http://localhost:5000/api/operators/607', {
            name: 'dilek',
            city: 'Ankara'
        }, { headers: { Authorization: 'Bearer ' + token } });
        console.log('PUT Response:', putRes.data);

        const getRes = await axios.get('http://localhost:5000/api/operators?limit=1000', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const dilek = getRes.data.find(o => o.id == 607);
        console.log('Dilek profile from GET /api/operators:', dilek ? { id: dilek.id, name: dilek.name, city: dilek.city } : 'Not found');
    } catch(err) {
        console.error(err.response ? err.response.data : err.message);
    } finally {
        pool.end();
    }
}
testDilek();
