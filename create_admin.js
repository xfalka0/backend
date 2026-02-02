const db = require('./db');
const bcrypt = require('bcrypt');
require('dotenv').config();

const createAdmin = async () => {
    const username = process.argv[2] || 'admin';
    const password = process.argv[3] || 'admin123';
    const email = process.argv[4] || 'admin@example.com';

    console.log(`Creating Admin User: ${username} / ${email}`);

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            "INSERT INTO users (username, email, password_hash, role, balance, account_status) VALUES ($1, $2, $3, 'admin', 0, 'active') ON CONFLICT (username) DO NOTHING",
            [username, email, hashedPassword]
        );

        // Also check if email conflict if username didn't conflict but email might
        const check = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        if (check.rows.length > 0) {
            console.log('Admin user exists or created successfully.');
            console.log(`Login with: ${email} / ${password}`);
        } else {
            console.log('Failed to create admin (unknown reason).');
        }

    } catch (err) {
        if (err.code === '23505') {
            console.log('Admin user already exists.');
        } else {
            console.error('Error creating admin:', err.message);
        }
    } finally {
        process.exit();
    }
};

createAdmin();
