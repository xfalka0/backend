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

        // 1. Get recent messages in chat 3316
        const msgRes = await client.query(`
            SELECT m.id, m.chat_id, m.sender_id, u.username, u.gender, u.role, m.content, m.content_type, m.is_replied, m.earned_diamonds, m.created_at
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = 3316
            ORDER BY m.created_at DESC;
        `);
        console.log('Messages in chat 3316:');
        console.table(msgRes.rows);

        // 2. Print details of both users 591 and 592
        const usersRes = await client.query('SELECT id, username, gender, role, balance, agency_id FROM users WHERE id IN (591, 592)');
        console.log('User Details for 591 and 592:');
        console.table(usersRes.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
