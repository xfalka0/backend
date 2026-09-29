require('dotenv').config();
const db = require('./db');

async function test() {
    try {
        const userId = 700;
        const targetGender = 'kadin';
        const limitNum = 20;
        const offset = 0;
        
        let whereClause = `WHERE (LOWER(u.gender) = LOWER($1) OR u.gender = 'coin_bayisi' OR (LOWER($1) = 'kadin' AND LOWER(u.gender) IN ('kadin', 'kadın', 'female')) OR (LOWER($1) = 'erkek' AND LOWER(u.gender) IN ('erkek', 'male'))) AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff') AND (u.gender_confirmed_at IS NOT NULL OR u.role = 'operator' OR u.gender = 'coin_bayisi')`;
        let orderByClause = 'ORDER BY u.created_at DESC, u.id DESC';

        const query = `
            SELECT 
                u.id, 
                u.role,
                u.gender,
                CASE WHEN o.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_operator
            FROM users u
            LEFT JOIN operators o ON u.id = o.user_id
            ${whereClause}
              AND u.id != $2
              AND u.account_status = 'active'
            ${orderByClause}
            LIMIT $3 OFFSET $4
        `;

        const queryParams = [targetGender, userId, limitNum, offset];
        const result = await db.query(query, queryParams);
        console.log('Results:', result.rows);
    } catch(e) {
        console.error('Error:', e);
    }
    process.exit(0);
}
test();
