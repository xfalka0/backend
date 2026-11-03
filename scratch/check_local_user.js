const db = require('../db');
(async () => {
    const res = await db.query("SELECT id, username, age FROM users WHERE id = 'c2004884-a53f-4bb0-8f6b-014b039427dc'");
    console.log('Local DB User:', res.rows[0]);
    await db.pool.end();
})();

