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

        // 1. Get recent messages in production
        const msgRes = await client.query(`
            SELECT m.id, m.chat_id, m.sender_id, u.username, u.gender, u.role, m.content, m.content_type, m.is_replied, m.earned_diamonds, m.created_at
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            ORDER BY m.created_at DESC
            LIMIT 10;
        `);
        console.log('Recent 10 messages in Production:');
        console.table(msgRes.rows);

        // 2. Get recent commission logs
        const logsRes = await client.query(`
            SELECT * FROM commission_logs
            ORDER BY created_at DESC
            LIMIT 10;
        `);
        console.log('Recent 10 commission logs in Production:');
        console.table(logsRes.rows);

        // 3. Inspect operator_stats
        const statsRes = await client.query(`
            SELECT * FROM operator_stats
            ORDER BY date DESC
            LIMIT 10;
        `);
        console.log('Operator stats:');
        console.table(statsRes.rows);

        // 4. Let's see if the chat's operator_id and user_id are configured correctly.
        if (msgRes.rows.length > 0) {
            const chatId = msgRes.rows[0].chat_id;
            const chatRes = await client.query('SELECT * FROM chats WHERE id = $1', [chatId]);
            console.log('Chat Info for recent chat:', chatRes.rows[0]);
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
