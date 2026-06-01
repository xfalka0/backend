const db = require('../db');

async function run() {
    try {
        console.log("Listing recent messages in local database...");
        const res = await db.query(`
            SELECT m.id, m.chat_id, m.sender_id, u.username, u.gender, u.role, m.content, m.created_at, m.is_replied, m.earned_diamonds
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            ORDER BY m.created_at DESC
            LIMIT 15;
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
