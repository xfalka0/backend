const db = require('./db');

async function checkMessages() {
    try {
        console.log("Checking user messages...");
        const res = await db.query(`
            SELECT m.id, m.content, u.role, u.username
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE u.role = 'user'
            ORDER BY m.created_at DESC
            LIMIT 10;
        `);
        
        console.log(`Found ${res.rows.length} messages from users (role = 'user'):`);
        res.rows.forEach(r => console.log(`- ${r.username}: ${r.content}`));
        
        const countRes = await db.query(`
            SELECT COUNT(*) FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE u.role = 'user'
        `);
        console.log(`\nTotal messages from 'user' role: ${countRes.rows[0].count}`);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkMessages();
