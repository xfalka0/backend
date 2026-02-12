const db = require('./db');

async function debug() {
    try {
        console.log('--- PRODUCT PACKAGES ---');
        const packages = await db.query('SELECT * FROM product_packages');
        console.table(packages.rows);

        console.log('\n--- MESSAGES (Unread Count Check) ---');
        const unread = await db.query(`
            SELECT chat_id, sender_id, content, is_read 
            FROM messages 
            WHERE is_read = false 
            LIMIT 10
        `);
        console.table(unread.rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
