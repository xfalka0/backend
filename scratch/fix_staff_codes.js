const db = require('../db');

async function fixCodes() {
    try {
        const users = await db.query("SELECT id FROM users WHERE referral_code IS NULL AND role IN ('admin', 'moderator', 'operator', 'staff', 'affiliater')");
        console.log(`Found ${users.rows.length} users without codes.`);
        
        for (const user of users.rows) {
            const code = Math.random().toString(36).substring(2, 10).toUpperCase();
            await db.query("UPDATE users SET referral_code = $1 WHERE id = $2", [code, user.id]);
            console.log(`Assigned ${code} to user ${user.id}`);
        }
        
        console.log('Done!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixCodes();
