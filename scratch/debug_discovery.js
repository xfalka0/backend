const pool = require('../db');

async function debugDiscovery() {
    try {
        const targetGender = 'erkek'; // Assuming the user is female
        const query = `
            SELECT 
                u.id, 
                COALESCE(u.display_name, u.username) as name, 
                u.gender, 
                u.role
            FROM users u
            WHERE (u.gender = $1 OR u.gender = 'coin_bayisi')
              AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff')
              AND u.account_status = 'active'
            ORDER BY u.created_at DESC
            LIMIT 20
        `;

        const res = await pool.query(query, [targetGender]);
        console.log('Discovery Results for Male User (Target: kadin):');
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugDiscovery();
