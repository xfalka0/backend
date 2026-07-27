const db = require('../db');

async function testViewsQuery() {
    try {
        console.log('--- Testing /views/:userId query ---');
        const userRes = await db.query("SELECT id FROM users LIMIT 1");
        if (userRes.rows.length === 0) {
            console.log('No users found in DB');
            process.exit(0);
        }
        const userId = userRes.rows[0].id;
        console.log('Testing with User ID:', userId);

        const views = await db.query(`
            SELECT DISTINCT ON (v.viewer_id) 
                   v.id as view_id, u.id, u.username, u.avatar_url, u.gender, v.created_at,
                   o.is_online, u.vip_level
            FROM profile_views v
            JOIN users u ON v.viewer_id::text = u.id::text
            LEFT JOIN operators o ON u.id::text = o.user_id::text
            WHERE v.viewed_user_id::text = $1::text
            ORDER BY v.viewer_id, v.created_at DESC
        `, [userId]);

        console.log('Query 1 Success! Rows:', views.rows.length);

        console.log('--- Testing /views/history/:userId query ---');
        const history = await db.query(`
            SELECT DISTINCT ON (v.viewed_user_id)
                   v.id as view_id, u.id, u.username, u.avatar_url, u.gender, v.created_at,
                   o.is_online, u.vip_level
            FROM profile_views v
            JOIN users u ON v.viewed_user_id::text = u.id::text
            LEFT JOIN operators o ON u.id::text = o.user_id::text
            WHERE v.viewer_id::text = $1::text
            ORDER BY v.viewed_user_id, v.created_at DESC
        `, [userId]);

        console.log('Query 2 Success! Rows:', history.rows.length);

        process.exit(0);
    } catch (err) {
        console.error('Views Query Error:', err.message);
        process.exit(1);
    }
}

testViewsQuery();
