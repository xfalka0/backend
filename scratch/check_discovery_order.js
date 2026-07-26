const db = require('../db');

async function testQuery() {
    try {
        const query = `
            SELECT 
                u.id, u.username, u.created_at, o.is_online,
                (u.created_at >= NOW() - INTERVAL '3 days') as is_newbie
            FROM users u
            LEFT JOIN operators o ON u.id::text = o.user_id::text
            WHERE u.account_status = 'active'
            ORDER BY o.is_online DESC NULLS LAST, (u.created_at >= NOW() - INTERVAL '3 days') DESC, u.created_at DESC
            LIMIT 5
        `;
        const res = await db.query(query);
        console.log('Discovery Query Top 5 Users:');
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

testQuery();
