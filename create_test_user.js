const db = require('./db');
const bcrypt = require('bcrypt');

async function createTestUser() {
    try {
        const email = 'test@test.com';
        const password = '123456';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if user exists
        const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        if (existing.rows.length > 0) {
            console.log('Test user already exists!');
            console.log('Email:', email);
            console.log('Password:', password);
            console.log('User ID:', existing.rows[0].id);
            return;
        }

        // Create user
        const username = 'testuser_' + Date.now();
        const result = await db.query(
            `INSERT INTO users (username, email, password_hash, role, balance, display_name, avatar_url) 
             VALUES ($1, $2, $3, 'user', 100, $4, 'https://via.placeholder.com/150') 
             RETURNING *`,
            [username, email, hashedPassword, 'Test User']
        );

        console.log('Test user created successfully!');
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('User ID:', result.rows[0].id);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        process.exit();
    }
}

createTestUser();
