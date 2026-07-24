const db = require('../db');

async function inspect() {
    try {
        const chatsCols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'chats'");
        console.log('CHATS COLUMNS:');
        console.log(chatsCols.rows);

        const msgsCols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'messages'");
        console.log('\nMESSAGES COLUMNS:');
        console.log(msgsCols.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

inspect();
