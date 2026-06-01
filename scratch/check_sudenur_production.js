const { Client } = require('pg');

const productionConnectionString = 'postgres://dating_user:Tog402dM1xT3K6FidYqTq6N7D1K1I4I3@dpg-cv5hbeogph6c73dg0t1g-a.frankfurt-postgres.render.com/dating_eexy';

async function run() {
    console.log('--- CONNECTING TO PRODUCTION RENDER DB (dating_eexy) ---');
    const client = new Client({
        connectionString: productionConnectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to Render DB successfully!');

        // 1. Search for sudenur
        const userRes = await client.query("SELECT * FROM users WHERE username ILIKE '%sudenur%' OR email ILIKE '%sudenur%'");
        if (userRes.rows.length === 0) {
            console.log('No user named Sudenur found in production DB!');
            
            // Let's print the most recent 10 users in production to see who is there
            console.log('Listing 10 most recent users in production:');
            const recentRes = await client.query("SELECT id, username, email, role, gender, created_at FROM users ORDER BY created_at DESC LIMIT 10");
            console.table(recentRes.rows);
            return;
        }

        console.log(`Found ${userRes.rows.length} users with Sudenur in username/email in production.`);
        for (const user of userRes.rows) {
            console.log('User Record:', {
                id: user.id,
                username: user.username,
                email: user.email,
                gender: user.gender,
                role: user.role,
                agency_id: user.agency_id || null,
                balance: user.balance
            });

            // 2. Find operator record
            const opRes = await client.query('SELECT * FROM operators WHERE user_id = $1', [user.id]);
            console.log('Operator Record count:', opRes.rows.length);
            if (opRes.rows.length > 0) {
                console.log('Operator Record Details:', opRes.rows[0]);
            }

            // 3. Find chats involving this user
            const chatsRes = await client.query("SELECT * FROM chats WHERE operator_id = $1 OR user_id = $1", [user.id]);
            console.log('Chats involving user count:', chatsRes.rows.length);
            for (const chat of chatsRes.rows) {
                console.log(`Chat ID: ${chat.id} | operator_id: ${chat.operator_id} | user_id: ${chat.user_id}`);
                const msgRes = await client.query(
                    "SELECT id, sender_id, content, content_type, is_replied, earned_diamonds, created_at FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 5",
                    [chat.id]
                );
                console.log(`Last 5 messages for chat ${chat.id}:`);
                console.table(msgRes.rows);
            }
        }

        // 4. Print active agencies
        const agenciesRes = await client.query("SELECT id, name, status FROM agencies");
        console.log('Agencies in Production:');
        console.table(agenciesRes.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
