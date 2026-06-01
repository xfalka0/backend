const db = require('../db');

async function run() {
    try {
        console.log("Checking all recently registered users...");
        const res = await db.query(`
            SELECT id, username, email, onboarding_completed, account_status, balance, created_at, role, gender, agency_id
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 20;
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
