const db = require('./db');
(async () => {
    try {
        const res = await db.query('SELECT id, username, email, role, balance, created_at FROM users');
        console.log('--- USERS LIST ---');
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
