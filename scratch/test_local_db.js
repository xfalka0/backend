const db = require('../db');

(async () => {
    try {
        const res = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
        console.log('Tables:', res.rows.map(r => r.table_name));

        const userCols = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='users'");
        console.log('User columns:', userCols.rows.map(r => r.column_name));
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await db.pool.end();
    }
})();

