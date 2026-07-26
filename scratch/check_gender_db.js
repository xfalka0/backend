const db = require('../db');

async function checkGenders() {
    try {
        const res = await db.query(`SELECT DISTINCT gender, COUNT(*) FROM users GROUP BY gender`);
        console.log('Distinct genders in DB:');
        console.table(res.rows);

        const sample = await db.query(`SELECT id, username, display_name, gender, role FROM users LIMIT 10`);
        console.log('Sample users:');
        console.table(sample.rows);
        process.exit(0);
    } catch (err) {
        console.error('DB Error:', err.message);
        process.exit(1);
    }
}

checkGenders();
