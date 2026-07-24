const { pool } = require('../db');

async function fixPastUnrepliedMessages() {
    try {
        console.log('[FIX] Updating past unreplied customer messages in chats where operator has replied...');
        
        const result = await pool.query(`
            UPDATE messages m
            SET is_replied = true
            WHERE m.is_replied = false OR m.is_replied IS NULL
              AND EXISTS (
                  SELECT 1 FROM messages r
                  WHERE r.chat_id = m.chat_id
                    AND r.created_at > m.created_at
                    AND r.sender_id != m.sender_id
              )
        `);
        
        console.log(`[FIX SUCCESS] Updated ${result.rowCount} past customer messages to is_replied = true!`);
        process.exit(0);
    } catch (err) {
        console.error('[FIX ERROR]:', err.message);
        process.exit(1);
    }
}

fixPastUnrepliedMessages();
