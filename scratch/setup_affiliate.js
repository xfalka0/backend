const db = require('../db');
const bcrypt = require('bcrypt');

async function setupAffiliate() {
    const username = 'affiliate1';
    const referralCode = 'AFF1';

    try {
        const userRes = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        
        if (userRes.rows.length === 0) {
            console.log(`User ${username} not found. Creating...`);
            const passHash = await bcrypt.hash('aff123', 10);
            await db.query(
                "INSERT INTO users (username, email, password_hash, role, referral_code, account_status) VALUES ($1, $2, $3, $4, $5, 'active')",
                [username, 'affiliate1@fivachat.com', passHash, 'affiliater', referralCode]
            );
            console.log(`User ${username} created with code ${referralCode}`);
        } else {
            console.log(`User ${username} found. Updating code...`);
            await db.query(
                "UPDATE users SET referral_code = $1, role = 'affiliater' WHERE username = $2",
                [referralCode, username]
            );
            console.log(`User ${username} updated with code ${referralCode}`);
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

setupAffiliate();
