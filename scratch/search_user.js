const db = require('../db');
const run = async () => {
    try {
        const res = await db.query("SELECT id, username, email, balance, role FROM users WHERE email ILIKE '%sevan%' OR username ILIKE '%sevan%'");
        console.log('Results:', res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
};
run();
