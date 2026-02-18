
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function updateUser() {
    try {
        const client = await pool.connect();
        const res = await client.query(
            "UPDATE users SET gender = 'kadin' WHERE email = 'mustafacaglar786@gmail.com' RETURNING *"
        );
        if (res.rows.length > 0) {
            console.log('User updated successfully:', res.rows[0]);
        } else {
            console.log('User not found!');
        }
        client.release();
    } catch (err) {
        console.error('Error updating user:', err);
    } finally {
        await pool.end();
    }
}
updateUser();

async function updateUser() {
    try {
        const client = await pool.connect();
        const res = await client.query(
            "UPDATE users SET gender = 'kadin' WHERE email = 'mustafacaglar786@gmail.com' RETURNING *"
        );
        if (res.rows.length > 0) {
            console.log('User updated successfully:', res.rows[0]);
        } else {
            console.log('User not found!');
        }
        client.release();
    } catch (err) {
        console.error('Error updating user:', err);
    } finally {
        await pool.end();
    }
}
updateUser();
