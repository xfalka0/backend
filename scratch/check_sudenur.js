const db = require('../db');

async function run() {
    try {
        console.log('--- DIAGNOSTIC FOR SUDENUR ---');
        // 1. Find user by username like Sudenur
        const userRes = await db.query("SELECT * FROM users WHERE username ILIKE '%sudenur%'");
        if (userRes.rows.length === 0) {
            console.log('No user named Sudenur found!');
            return;
        }

        console.log(`Found ${userRes.rows.length} users with Sudenur in username.`);
        for (const user of userRes.rows) {
            console.log('User Record:', {
                id: user.id,
                username: user.username,
                gender: user.gender,
                role: user.role,
                agency_id: user.agency_id,
                balance: user.balance
            });

            // 2. Find any operators record for her
            const opRes = await db.query('SELECT * FROM operators WHERE user_id = $1', [user.id]);
            console.log('Operator Record count:', opRes.rows.length);
            if (opRes.rows.length > 0) {
                console.log('Operator Record Details:', opRes.rows[0]);
            }

            // 3. Find active chats involving this user
            const chatsRes = await db.query("SELECT * FROM chats WHERE operator_id = $1 OR user_id = $1", [user.id]);
            console.log('Chats involving user count:', chatsRes.rows.length);
            for (const chat of chatsRes.rows) {
                console.log(`Chat ID: ${chat.id} | operator_id: ${chat.operator_id} | user_id: ${chat.user_id}`);
                // Check messages for this chat
                const msgRes = await db.query("SELECT id, sender_id, content, content_type, is_replied, earned_diamonds, created_at FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 5", [chat.id]);
                console.log(`Last 5 messages for chat ${chat.id}:`);
                console.log(msgRes.rows);
            }
        }

        // 4. Find active agencies
        const agenciesRes = await db.query("SELECT id, name, status FROM agencies");
        console.log('Agencies:', agenciesRes.rows);

    } catch (err) {
        console.error('Error during query:', err.message);
    } finally {
        process.exit();
    }
}

run();
