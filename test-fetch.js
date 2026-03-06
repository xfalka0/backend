const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });
const pool = new Pool({});

pool.query(`
    SELECT u.id, u.display_name, u.avatar_url, o.photos
    FROM users u 
    LEFT JOIN operators o ON u.id = o.user_id 
    WHERE u.gender = 'kadin'
    ORDER BY u.created_at DESC 
    LIMIT 20 OFFSET 5
`).then(res => {
    console.log('Query finished. Total:', res.rows.length);
    res.rows.forEach(r => console.log(r.display_name, '| Avatar:', r.avatar_url, '| Photos:', r.photos ? r.photos.length : 0));
    pool.end();
}).catch(console.error);
