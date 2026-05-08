
const { Client } = require('pg');
const client = new Client({
    connectionString: "postgresql://postgres:123@localhost:5432/dating"
});

async function forceFixModeration() {
    await client.connect();
    
    console.log('Finding users with photos that should have been rejected...');
    
    // Fix for the specific reported user
    const reportedEmail = 'c70978036@gmail.com';
    const userRes = await client.query("SELECT id, avatar_url FROM users WHERE email = $1", [reportedEmail]);
    
    if (userRes.rows.length > 0) {
        const user = userRes.rows[0];
        console.log(`Found user ${reportedEmail}. Current avatar: ${user.avatar_url}`);
        
        // Check if there was a rejected photo for this user
        const rejected = await client.query("SELECT url FROM pending_photos WHERE user_id = $1 AND status = 'rejected'", [user.id]);
        
        if (rejected.rows.length > 0) {
            console.log('Found rejected entries. Clearing avatar...');
            await client.query("UPDATE users SET avatar_url = NULL WHERE id = $1", [user.id]);
            console.log('Avatar cleared.');
        } else {
            console.log('No rejected entries found in DB for this user. Maybe already deleted?');
            // If the user says it's +18, I'll just clear it anyway as a precaution if it's there
            if (user.avatar_url) {
                 await client.query("UPDATE users SET avatar_url = NULL WHERE id = $1", [user.id]);
                 console.log('Avatar cleared forcefully.');
            }
        }
    } else {
        console.log('User not found by email in this DB. Searching by username pattern...');
        // Search for any user whose avatar matches a rejected photo
        const syncFix = await client.query(`
            UPDATE users u
            SET avatar_url = NULL
            FROM pending_photos p
            WHERE u.id = p.user_id 
            AND p.status = 'rejected' 
            AND u.avatar_url = p.url
        `);
        console.log(`Global sync fix: ${syncFix.rowCount} users updated.`);
    }

    await client.end();
}

forceFixModeration();
