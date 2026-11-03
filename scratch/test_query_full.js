const db = require('../db');

(async () => {
    try {
        const targetGender = 'kadin';
        const userId = 'c2004884-a53f-4bb0-8f6b-014b039427dc'; // from the logs
        const limitNum = 50;
        const offset = 0;
        
        let whereClause = `WHERE (LOWER(u.gender) = LOWER($1) OR u.gender = 'coin_bayisi' OR (LOWER($1) = 'kadin' AND LOWER(u.gender) IN ('kadin', 'kadın', 'female')) OR (LOWER($1) = 'erkek' AND LOWER(u.gender) IN ('erkek', 'male'))) AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff') AND (u.gender_confirmed_at IS NOT NULL OR u.role = 'operator' OR u.gender = 'coin_bayisi')`;

        let orderByClause = 'ORDER BY o.is_online DESC NULLS LAST, (u.created_at >= NOW() - INTERVAL \'3 days\') DESC, COALESCE(active_boosts.val, FALSE) DESC, u.vip_level DESC, (coalesce(cardinality(o.photos), 0) > 0) DESC, u.created_at DESC, u.id DESC';

        const query = `
            SELECT 
                u.id, 
                COALESCE(u.display_name, u.username) as name, 
                u.avatar_url, 
                u.gender, 
                u.age, 
                u.vip_level, 
                u.job,
                u.relationship,
                u.zodiac,
                u.interests,
                u.role,
                u.boy,
                u.city,
                o.category, 
                o.rating, 
                o.is_online, 
                COALESCE(o.bio, u.bio) as bio, 
                o.photos,
                CASE WHEN o.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_operator,
                COALESCE(active_stories.val, FALSE) as has_active_story,
                COALESCE(active_boosts.val, FALSE) as is_boosted,
                un.expires_at as nobility_expires_at, 
                nt.key as nobility_key, 
                nt.name as nobility_name, 
                nt.level as nobility_level, 
                nt.badge_url as nobility_badge_url, 
                nt.name_color as nobility_name_color,
                a.name as agency_name
            FROM users u
            LEFT JOIN operators o ON u.id = o.user_id
            LEFT JOIN user_nobility un ON u.id = un.user_id AND un.is_active = TRUE AND un.expires_at > NOW()
            LEFT JOIN nobility_titles nt ON un.title_id = nt.id
            LEFT JOIN agencies a ON u.agency_id::text = a.id::text
            LEFT JOIN LATERAL (
                SELECT TRUE as val FROM boosts b WHERE b.user_id = u.id AND b.end_time > NOW() LIMIT 1
            ) active_boosts ON TRUE
            LEFT JOIN LATERAL (
                SELECT TRUE as val FROM stories s WHERE s.operator_id = u.id AND s.expires_at > NOW() LIMIT 1
            ) active_stories ON TRUE
            ${whereClause}
              AND u.id != $2
              AND u.account_status = 'active'
            ${orderByClause}
            LIMIT $3 OFFSET $4
        `;
        const queryParams = [targetGender, userId, limitNum, offset];
        const res = await db.query(query, queryParams);
        console.log("SUCCESS!");
    } catch (err) {
        console.error("FAILED:");
        console.error(err);
    } finally {
        process.exit();
    }
})();
