const db = require('../db');

async function getReferralStats() {
    try {
        console.log('\n--- REFERRAL PERFORMANCE REPORT ---\n');
        
        const query = `
            SELECT 
                r.username as referrer,
                r.referral_code,
                r.role,
                COUNT(u.id) as total_referrals,
                SUM(CASE WHEN u.created_at >= CURRENT_DATE THEN 1 ELSE 0 END) as referrals_today,
                SUM(u.balance) as total_referred_balance
            FROM users r
            JOIN users u ON u.referred_by = r.id
            GROUP BY r.id, r.username, r.referral_code, r.role
            ORDER BY total_referrals DESC
        `;
        
        const res = await db.query(query);
        
        if (res.rows.length === 0) {
            console.log('Henüz referans ile gelen kullanıcı bulunmuyor.');
        } else {
            console.table(res.rows);
        }
        
        console.log('\n-----------------------------------\n');
        process.exit(0);
    } catch (err) {
        console.error('Error fetching referral stats:', err);
        process.exit(1);
    }
}

getReferralStats();
