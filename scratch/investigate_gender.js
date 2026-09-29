const db = require('../db');

async function run() {
    try {
        console.log("=== 1.a) Specific profiles ===");
        const res1 = await db.query(`SELECT id, username, display_name, gender, role FROM users WHERE display_name IN ('SÜL', 'Sezer', 'Berkay Deniz', 'dursun')`);
        console.table(res1.rows);

        console.log("\n=== 1.b) Gender grouping ===");
        const res2 = await db.query(`SELECT gender, COUNT(*) FROM users GROUP BY gender`);
        console.table(res2.rows);

        console.log("\n=== 1.c) Coin_bayisi grouping ===");
        const res3 = await db.query(`SELECT gender, role, COUNT(*) FROM users WHERE gender = 'coin_bayisi' OR role = 'coin_bayisi' GROUP BY gender, role`);
        console.table(res3.rows);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

run();
