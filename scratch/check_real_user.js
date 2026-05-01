
const db = require('../db');

async function checkUser() {
    try {
        const res = await db.query('SELECT username, email, role, balance, account_status FROM users WHERE email = $1', ['sevansoguttlu@gmail.com']);
        if (res.rows.length > 0) {
            console.log('--- USER DATA FROM DB ---');
            console.log(JSON.stringify(res.rows[0], null, 2));
            console.log('-------------------------');
        } else {
            console.log('User NOT found with email: sevansoguttlu@gmail.com');
            // Try by username part
            const res2 = await db.query("SELECT username, email, role, balance FROM users WHERE username LIKE '%sevansoguttlu%'");
            console.log('Search by username results:', res2.rows);
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkUser();
