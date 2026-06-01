const db = require('../db');

async function run() {
    try {
        console.log("Listing all local users with gender = 'kadin'...");
        const res = await db.query(`
            SELECT id, username, email, onboarding_completed, account_status, balance, created_at, role, gender, agency_id
            FROM users 
            WHERE gender = 'kadin'
            ORDER BY created_at DESC;
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
