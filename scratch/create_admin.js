const db = require('../db');
const bcrypt = require('bcrypt');

async function createAdmin() {
    try {
        const password = 'admin123456';
        const passwordHash = await bcrypt.hash(password, 10);

        // Find existing admin by username or email
        const existing = await db.query("SELECT id, username, email, role FROM users WHERE username = 'admin' OR LOWER(email) = 'admin@falka.com' OR LOWER(email) = 'hidden@falka.com'");
        console.log('Existing matched accounts:', existing.rows);

        // Update username='admin' to have admin@falka.com, passwordHash, role='admin'
        await db.query(`
            UPDATE users 
            SET email = 'admin@falka.com', password_hash = $1, role = 'admin', status = 'active', account_status = 'active'
            WHERE username = 'admin'
        `, [passwordHash]);
        console.log('Updated user "admin" with email: admin@falka.com and password: ' + password);

        // Also ensure hidden@falka.com exists or is updated
        const hiddenCheck = await db.query("SELECT id FROM users WHERE LOWER(email) = 'hidden@falka.com'");
        if (hiddenCheck.rows.length > 0) {
            await db.query(`
                UPDATE users 
                SET password_hash = $1, role = 'admin', status = 'active', account_status = 'active'
                WHERE id = $2
            `, [passwordHash, hiddenCheck.rows[0].id]);
            console.log('Updated user "hidden@falka.com" with password: ' + password);
        } else {
            await db.query(`
                INSERT INTO users (username, email, password_hash, role, display_name, status, account_status, balance)
                VALUES ('hidden_admin', 'hidden@falka.com', $1, 'admin', 'Hidden Admin', 'active', 'active', 10000)
            `, [passwordHash]);
            console.log('Created user "hidden@falka.com" with password: ' + password);
        }

        process.exit(0);
    } catch (err) {
        console.error('Error creating admin:', err);
        process.exit(1);
    }
}

createAdmin();
