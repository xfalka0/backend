const db = require('../db');

async function checkMessagesSchema() {
    try {
        const res = await db.query(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'messages'"
        );
        console.log('Messages columns:', res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkMessagesSchema();
