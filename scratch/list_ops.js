const db = require('../db');

async function listOperators() {
    try {
        const res = await db.query("SELECT * FROM operators LIMIT 10");
        console.log('Operators:', JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listOperators();
