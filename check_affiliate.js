const db = require('./db');

async function diagnostic() {
    console.log('--- AFFILIATE SYSTEM DIAGNOSTIC ---');
    
    // 1. Check last 5 clicks
    console.log('\n[1] RECENT REFERRAL CLICKS:');
    const clicks = await db.query('SELECT * FROM referral_clicks ORDER BY created_at DESC LIMIT 5');
    console.table(clicks.rows);
    
    // 2. Check last 5 registrations
    console.log('\n[2] RECENT USER REGISTRATIONS:');
    const users = await db.query('SELECT id, username, email, role, referred_by, created_at FROM users ORDER BY created_at DESC LIMIT 5');
    console.table(users.rows);
    
    // 3. Check for specific code 'AFF1'
    console.log('\n[3] SEARCHING FOR STAFF WITH CODE "AFF1":');
    const staff = await db.query('SELECT id, username, referral_code FROM users WHERE referral_code = $1', ['AFF1']);
    console.table(staff.rows);
    
    if (staff.rows.length === 0) {
        console.log('❌ ERROR: No staff found with referral_code "AFF1"');
    } else {
        const affiliateId = staff.rows[0].id;
        // 4. Count referrals for this affiliate
        const count = await db.query('SELECT COUNT(*) FROM users WHERE referred_by::text = $1', [affiliateId]);
        console.log(`\n[4] TOTAL REFERRALS FOR AFF1 (ID: ${affiliateId}): ${count.rows[0].count}`);
    }

    process.exit();
}

diagnostic().catch(err => {
    console.error(err);
    process.exit(1);
});
