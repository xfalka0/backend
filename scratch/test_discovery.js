const db = require('../db');

async function test() {
    const userId = 336;
    const targetGender = 'kadin';
    const limitNum = 20;
    const offset = 0;
    const whereClause = "WHERE (u.gender = $1 OR u.gender = 'coin_bayisi') AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff')";
    const orderByClause = 'ORDER BY o.is_online DESC NULLS LAST, COALESCE(active_boosts.val, FALSE) DESC, u.vip_level DESC, (coalesce(cardinality(o.photos), 0) > 0) DESC, u.created_at DESC, u.id DESC';
    const query = `
        SELECT 
            u.id, 
            COALESCE(u.display_name, u.username) as name, 
            u.avatar_url, 
            u.gender, 
            u.age, 
            u.vip_level, 
            u.job,
            u.role,
            u.boy,
            o.is_online,
            COALESCE(o.bio, u.bio) as bio
        FROM users u
        LEFT JOIN operators o ON u.id = o.user_id
        LEFT JOIN LATERAL (
            SELECT TRUE as val FROM boosts b WHERE b.user_id = u.id AND b.end_time > NOW() LIMIT 1
        ) active_boosts ON TRUE
        ${whereClause}
          AND u.id != $2
          AND u.account_status = 'active'
        ${orderByClause}
        LIMIT $3 OFFSET $4
    `;
    const queryParams = [targetGender, userId, limitNum, offset];
    try {
        const res = await db.query(query, queryParams);
        console.log('QUERY SUCCESSFUL');
        console.log('Returned rows count:', res.rows.length);
        console.log('Row names:', res.rows.map(r => `${r.name} (${r.gender})` ));
    } catch (e) {
        console.error('QUERY FAILED:', e);
    }
    process.exit();
}

test();
