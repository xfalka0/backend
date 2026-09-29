require('dotenv').config();
const db = require('./db');

async function test() {
    try {
        const userId = 700;
        const targetGender = 'kadin';
        
        const countRes = await db.query(`
            SELECT COUNT(*) 
            FROM users u
            LEFT JOIN operators o ON u.id = o.user_id
            WHERE (LOWER(u.gender) = 'kadin' OR u.gender = 'coin_bayisi') 
            AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff') 
            AND (u.gender_confirmed_at IS NOT NULL OR u.role = 'operator' OR u.gender = 'coin_bayisi')
            AND o.is_online = TRUE
        `);
        console.log('Online count:', countRes.rows[0].count);
    } catch(e) {
        console.error('Error:', e);
    }
    process.exit(0);
}
test();
