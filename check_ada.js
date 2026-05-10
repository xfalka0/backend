const db = require('./db');
const run = async () => {
    const res = await db.query("SELECT id, display_name, gender, age FROM users WHERE display_name ILIKE '%Ada%'");
    console.log(res.rows);
    process.exit(0);
};
run().catch(console.error);
