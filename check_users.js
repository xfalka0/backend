const db = require('./db');

(async () => {
    try {
        const res = await db.query('SELECT id, username, email, role, password_hash FROM users');
        console.log('--- ALL USERS ---');
        console.table(res.rows);
        console.log('-----------------');
    } catch (err) {
        console.error('Error fetching users:', err);
    }
})();
