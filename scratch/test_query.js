const db = require('../db');

(async () => {
    try {
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
            LIMIT 1
        `;
        const res = await db.query(query);
        console.log("SUCCESS!");
    } catch (err) {
        console.error("FAILED:");
        console.error(err.message);
    } finally {
        process.exit();
    }
})();
