const db = require('../db');

async function checkNotificationStatus() {
    try {
        console.log('--- NOTIFICATION DIAGNOSTIC ---');
        
        // 1. Count total users vs users with push tokens
        const totalRes = await db.query('SELECT COUNT(*)::int as count FROM users');
        const tokenRes = await db.query('SELECT COUNT(*)::int as count FROM users WHERE push_token IS NOT NULL AND push_token != \'\'');
        
        console.log(`Total Users (All Roles): ${totalRes.rows[0].count}`);
        console.log(`Users with Push Token: ${tokenRes.rows[0].count}`);
        
        // 2. Check recent token updates
        const recentRes = await db.query('SELECT id, username, push_token FROM users WHERE push_token IS NOT NULL LIMIT 10');
        console.log('\nUsers with tokens:');
        recentRes.rows.forEach(r => {
            console.log(`- ${r.username || r.id}: ${r.push_token.substring(0, 15)}...`);
        });

        if (tokenRes.rows[0].count === 0) {
            console.log('\n[WARNING] No users have push tokens in THIS database.');
        } else {
            console.log('\n[SUCCESS] Push tokens found.');
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkNotificationStatus();
