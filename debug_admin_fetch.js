const db = require('./db');
(async () => {
    try {
        console.log('--- DEBUG ADMIN FETCH ---');

        // 1. Total users
        const total = await db.query('SELECT COUNT(*) as count FROM users');
        console.log('Total users in DB:', total.rows[0].count);

        // 2. Users with role = 'user'
        const users = await db.query("SELECT COUNT(*) as count FROM users WHERE role = 'user'");
        console.log("Users with role = 'user':", users.rows[0].count);

        // 3. Roles present in DB
        const roles = await db.query('SELECT role, COUNT(*) FROM users GROUP BY role');
        console.log('Roles breakdown:');
        console.table(roles.rows);

        // 4. Sample 'user' record raw
        const sample = await db.query("SELECT * FROM users WHERE role = 'user' LIMIT 1");
        console.log('Sample user record (raw):', JSON.stringify(sample.rows[0], null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
