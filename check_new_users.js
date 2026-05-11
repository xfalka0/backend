const db = require('./db');

async function checkNewUsers() {
    try {
        console.log("Checking recently registered users...");
        const res = await db.query(`
            SELECT id, username, email, onboarding_completed, account_status, balance, created_at, role, gender
            FROM users 
            WHERE role = 'user'
            ORDER BY created_at DESC 
            LIMIT 15;
        `);
        
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkNewUsers();
