const db = require('../db');

async function main() {
    const res = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'chats'");
    console.log("Chats table columns:", res.rows);
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
