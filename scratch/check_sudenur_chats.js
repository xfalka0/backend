const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function run() {
    console.log('--- CONNECTING TO PRODUCTION RENDER DB ---');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        // 1. Find all chats involving Sudenur (user_id = 591)
        const chatsRes = await client.query(`
            SELECT id, operator_id, user_id, last_message, created_at 
            FROM chats 
            WHERE operator_id = 591 OR user_id = 591
            ORDER BY created_at DESC;
        `);
        console.log(`\nChats involving Sudenur (Count: ${chatsRes.rows.length}):`);
        console.table(chatsRes.rows);

        if (chatsRes.rows.length > 0) {
            const chatIds = chatsRes.rows.map(c => c.id);
            // 2. Fetch the 15 most recent messages across these chats
            const msgsRes = await client.query(`
                SELECT id, chat_id, sender_id, content, content_type, is_replied, created_at 
                FROM messages 
                WHERE chat_id = ANY($1) 
                ORDER BY created_at DESC 
                LIMIT 15;
            `, [chatIds]);
            console.log('\nMost recent 15 messages in Sudenur chats:');
            console.table(msgsRes.rows);
        } else {
            console.log('No active chats found for Sudenur.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
