
const { Client } = require('pg');
const client = new Client({
    connectionString: "postgresql://postgres:123@localhost:5432/dating"
});

async function checkUser() {
    await client.connect();
    console.log('Searching for users...');
    const res = await client.query("SELECT id, username, email, avatar_url, role FROM users WHERE email ILIKE '%c70978036%'");
    console.log('Users found:', res.rows);
    
    if (res.rows.length > 0) {
        for (const user of res.rows) {
            const pending = await client.query("SELECT * FROM pending_photos WHERE user_id = $1", [user.id]);
            console.log(`Pending Photos for ${user.email}:`, pending.rows);
        }
    } else {
        console.log('No user found with that email fragment.');
        const allUsers = await client.query("SELECT email FROM users ORDER BY created_at DESC LIMIT 5");
        console.log('Latest 5 users:', allUsers.rows);
    }
    await client.end();
}

checkUser();
