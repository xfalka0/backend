const db = require('../db');

async function findUser() {
    try {
        const res = await db.query("SELECT * FROM users WHERE boy = '179'");
        console.log('Found users:', JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findUser();
