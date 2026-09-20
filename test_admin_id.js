const db = require('./db');
async function run() {
    const res = await db.query("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
    console.log(res.rows[0].id);
    process.exit();
}
run();
