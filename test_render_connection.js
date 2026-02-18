const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

const client = new Client({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false,
    },
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to Render DB successfully!');

        const targetEmail = 'fdnsmn00@gmail.com'; // Fallback user

        // 1. Update Gender
        console.log(`\n--- Updating ${targetEmail} to 'erkek' ---`);
        await client.query("UPDATE users SET gender = 'erkek' WHERE email = $1", [targetEmail]);
        console.log('Update executed.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
