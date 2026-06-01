const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function run() {
    console.log('--- CLEANING UP ASDSADASD MESSAGE ---');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        // Update the asdsadasd message
        const res = await client.query(
            "UPDATE messages SET is_replied = false, earned_diamonds = 0 WHERE chat_id = 3316 AND content = 'asdsadasd' RETURNING *"
        );
        
        if (res.rows.length > 0) {
            console.log('✅ Cleaned up message successfully:');
            console.table(res.rows);
        } else {
            console.log('No message with content "asdsadasd" found in chat 3316.');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
