const db = require('./db');

async function checkOperators() {
    try {
        const result = await db.query("SELECT id, name, email FROM operators WHERE email LIKE '%mustafa%' OR name LIKE '%mustafa%'");
        console.log('--- MUSTAFA OPERATOR SEARCH RESULTS ---');
        console.log(JSON.stringify(result.rows, null, 2));

        const count = await db.query("SELECT COUNT(*) FROM operators");
        console.log('Total Operators:', count.rows[0].count);

        const allOps = await db.query("SELECT id, name, email FROM operators LIMIT 10");
        console.log('--- LATEST 10 OPERATORS ---');
        console.log(JSON.stringify(allOps.rows, null, 2));
    } catch (err) {
        console.error('Error checking operators:', err);
    } finally {
        process.exit();
    }
}

checkOperators();
