const { Client } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const client = new Client({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'dating',
    password: process.env.DB_PASSWORD || '123',
    port: process.env.DB_PORT || 5432,
    ssl: false // Assuming local since we are using individual params
});

async function resetPassword() {
    try {
        await client.connect();
        console.log('Connected to DB...');
        
        const newPassword = 'admin123';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        const res = await client.query(
            "UPDATE users SET password_hash = $1 WHERE email = $2",
            [hashedPassword, 'admin@example.com']
        );
        
        if (res.rowCount > 0) {
            console.log('Password updated successfully for admin@example.com!');
        } else {
            console.log('User admin@example.com not found in database.');
        }
    } catch (err) {
        console.error('Error updating password:', err);
    } finally {
        await client.end();
    }
}

resetPassword();
