const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });
const pool = new Pool({});

(async () => {
    try {
        const res = await pool.query(`
            SELECT u.id, u.display_name, o.photos, u.avatar_url
            FROM users u 
            LEFT JOIN operators o ON u.id = o.user_id 
            WHERE u.gender = 'kadin'
            ORDER BY u.created_at DESC 
            LIMIT 5 OFFSET 30
        `);
        res.rows.forEach(r => console.log('User:', r.display_name, 'Avatar:', r.avatar_url, 'Photos:', r.photos));
    } catch (e) {
        console.error(e.message);
    } finally {
        pool.end();
    }
})();
