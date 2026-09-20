require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        const tokenRes = await pool.query("SELECT id, role FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1");
        if(tokenRes.rows.length === 0) throw new Error("No admin found");
        const admin = tokenRes.rows[0];
        
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET || 'fiva_secret_key_2024!_#');
        
        const opRes = await pool.query("SELECT user_id FROM operators LIMIT 1");
        const opId = opRes.rows[0].user_id;
        
        console.log(`Updating operator user_id=${opId} with city='Ankara'`);
        
        const updateRes = await axios.put(`http://localhost:5000/api/operators/${opId}`, {
            name: "test_op",
            city: "Ankara"
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("Update response:", updateRes.data);
        
        const checkRes = await pool.query(`SELECT city FROM users WHERE id = ${opId}`);
        console.log("City in DB after update:", checkRes.rows[0].city);
        
    } catch(e) {
        console.error(e.response ? e.response.data : e.message);
    } finally {
        pool.end();
    }
}
run();
