const db = require('../db');

async function testFavoritesQuery() {
    try {
        console.log('--- Testing /favorites/:userId/fans query ---');
        const userRes = await db.query("SELECT id FROM users LIMIT 1");
        if (userRes.rows.length === 0) {
            console.log('No users found in DB');
            process.exit(0);
        }
        const userId = userRes.rows[0].id;

        const fans = await db.query(`
            SELECT u.id, COALESCE(u.display_name, u.username) as name, u.username, u.avatar_url, u.gender, u.is_vip, f.created_at,
                   o.is_online
            FROM favorites f
            JOIN users u ON f.user_id::text = u.id::text
            LEFT JOIN operators o ON u.id::text = o.user_id::text
            WHERE f.target_user_id::text = $1::text
            ORDER BY f.created_at DESC
        `, [userId]);

        console.log('Fans Query Success! Rows:', fans.rows.length);

        const myFavs = await db.query(`
            SELECT u.id, COALESCE(u.display_name, u.username) as name, u.username, u.avatar_url, u.gender, u.is_vip, f.created_at,
                   o.is_online
            FROM favorites f
            JOIN users u ON f.target_user_id::text = u.id::text
            LEFT JOIN operators o ON u.id::text = o.user_id::text
            WHERE f.user_id::text = $1::text
            ORDER BY f.created_at DESC
        `, [userId]);

        console.log('My Favs Query Success! Rows:', myFavs.rows.length);

        process.exit(0);
    } catch (err) {
        console.error('Favorites Query Error:', err.message);
        process.exit(1);
    }
}

testFavoritesQuery();
