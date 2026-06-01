const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function run() {
    console.log('--- CHECKING SENDERS IN CHAT 3316 ---');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        // Query the most recent messages in chat 3316
        const res = await client.query(
            "SELECT id, sender_id, content, created_at FROM messages WHERE chat_id = 3316 ORDER BY created_at DESC LIMIT 5"
        );
        console.table(res.rows);

        // If sdfsdfsdf was sent by female user but saved as 592, let's fix it!
        // Sudenur's messages usually have content 'sdfsdfsdf', 'fdgdf', 'fgh' etc.
        // Batuhan sent 'fgfd', 'asdsadasd', 'xfvdfg', 'hg', 's'
        // Let's update any message in chat 3316 with content 'sdfsdfsdf' or 'fdgdf' or 'fgh' or 'd' to have sender_id = 591 if they currently have 592.
        const fix1 = await client.query(
            "UPDATE messages SET sender_id = '591' WHERE chat_id = 3316 AND content IN ('sdfsdfsdf') AND sender_id = '592' RETURNING *"
        );
        if (fix1.rows.length > 0) {
            console.log('✅ Fixed sdfsdfsdf sender_id successfully:');
            console.table(fix1.rows);
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
