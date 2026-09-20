require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        const opRes = await pool.query("SELECT user_id FROM operators LIMIT 1");
        const opId = opRes.rows[0].user_id;
        
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ id: opId, role: 'operator' }, process.env.JWT_SECRET || 'fiva_secret_key_2024!_#');
        
        console.log(`Updating profile for user_id=${opId} with city='Bursa'`);
        
        const updateRes = await axios.put(`http://localhost:5000/api/users/${opId}/profile`, {
            city: "Bursa"
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("Update response:", updateRes.data);
        
        const checkRes = await pool.query(`SELECT city FROM users WHERE id = ${opId}`);
        console.log("City in DB after profile update:", checkRes.rows[0].city);
        
    } catch(e) {
        console.error("ERROR:", e.response ? e.response.data : e.message);
    } finally {
        pool.end();
    }
}
run();
