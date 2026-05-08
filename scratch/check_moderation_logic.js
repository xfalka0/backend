
const { Client } = require('pg');
const client = new Client({
    connectionString: "postgresql://postgres:123@localhost:5432/dating"
});

async function checkModeration() {
    await client.connect();
    console.log('Checking pending_photos table...');
    const res = await client.query("SELECT * FROM pending_photos ORDER BY created_at DESC LIMIT 20");
    console.log('Recent photos:', res.rows);
    
    const rejectedButStillSet = await client.query(`
        SELECT u.id, u.email, u.avatar_url, p.url as rejected_url, p.status 
        FROM users u 
        JOIN pending_photos p ON u.id = p.user_id 
        WHERE p.status = 'rejected' AND u.avatar_url = p.url
    `);
    console.log('Users with REJECTED avatar still set:', rejectedButStillSet.rows);

    await client.end();
}

checkModeration();
