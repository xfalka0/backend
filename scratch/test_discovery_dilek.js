require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const jwt = require('jsonwebtoken');

async function testDiscovery() {
    try {
        const userRes = await pool.query("SELECT id, role, gender FROM users WHERE role NOT IN ('admin', 'super_admin') LIMIT 1");
        const u = userRes.rows[0];
        const token = jwt.sign({ id: u.id, role: u.role, gender: u.gender }, process.env.JWT_SECRET || 'fiva_secret_key_2024!_#');

        const getRes = await axios.get('http://localhost:5000/api/discovery?tab=Önerilen&page=1&limit=50', {
            headers: { Authorization: 'Bearer ' + token }
        });
        const dilek = getRes.data.find(o => o.id == 607 || o.name == 'dilek');
        console.log('Dilek item in discovery API response:', dilek ? { id: dilek.id, name: dilek.name, city: dilek.city, distance_km: dilek.distance_km } : 'Not found in page 1');
    } catch(err) {
        console.error(err.response ? err.response.data : err.message);
    } finally {
        pool.end();
    }
}
testDiscovery();
