const db = require('../db');

async function checkChatsSchema() {
    try {
        console.log('--- CHATS SCHEMA ---');
        const res = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'chats'");
        console.log(JSON.stringify(res.rows, null, 2));

        console.log('\n--- USERS ID TYPE ---');
        const res2 = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id'");
        console.log(JSON.stringify(res2.rows, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkChatsSchema();
