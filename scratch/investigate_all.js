const db = require('../db');

async function run() {
    try {
        console.log("=== All Users ===");
        const res = await db.query(`SELECT id, username, display_name, gender, role FROM users`);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

run();
