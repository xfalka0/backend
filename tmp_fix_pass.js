const db = require('./db.js');
const bcrypt = require('bcrypt');

async function run() {
    try {
        const hash = await bcrypt.hash('admin123', 10);
        console.log('Generated hash:', hash);
        const res = await db.query("UPDATE users SET password_hash = $1 WHERE email = 'admin@example.com'", [hash]);
        console.log('Update result rowCount:', res.rowCount);
        
        const verify = await db.query("SELECT password_hash FROM users WHERE email = 'admin@example.com'");
        console.log('Verified hash in DB:', verify.rows[0].password_hash);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

run();
