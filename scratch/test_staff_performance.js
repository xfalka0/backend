const db = require('../db');

async function testFullQuery() {
    try {
        const query = `
            SELECT 
                u.id, 
                u.username, 
                u.display_name, 
                u.avatar_url, 
                u.role,
                (
                    SELECT COUNT(*)::int 
                    FROM messages m 
                    WHERE m.sender_id = u.id AND m.created_at >= CURRENT_DATE
                ) as messages_today,
                (
                    SELECT COUNT(*)::int 
                    FROM messages m 
                    WHERE m.sender_id = u.id AND m.created_at >= NOW() - interval '7 days'
                ) as messages_week,
                (
                    SELECT COALESCE(ROUND(AVG(
                        cardinality(regexp_split_to_array(trim(m.content), '\\s+'))
                    ), 1), 0)::float
                    FROM messages m
                    WHERE m.sender_id = u.id 
                      AND m.content IS NOT NULL 
                      AND trim(m.content) != ''
                      AND (m.content_type = 'text' OR m.content_type IS NULL OR m.content_type = '')
                ) as avg_word_count,
                (
                    SELECT COALESCE(ROUND(AVG(
                        EXTRACT(EPOCH FROM (m.created_at - m_prev.prev_created_at))
                    )), 0)::int
                    FROM messages m
                    JOIN LATERAL (
                        SELECT created_at as prev_created_at
                        FROM messages m2
                        WHERE m2.chat_id = m.chat_id
                          AND m2.created_at < m.created_at
                          AND m2.sender_id != m.sender_id
                        ORDER BY m2.created_at DESC
                        LIMIT 1
                    ) m_prev ON TRUE
                    WHERE m.sender_id = u.id
                      AND m.created_at >= NOW() - interval '30 days'
                      AND EXTRACT(EPOCH FROM (m.created_at - m_prev.prev_created_at)) <= 86400
                ) as avg_response_time_seconds,
                COALESCE(os_today.messages_sent, 0) as messages_sent,
                COALESCE(os_today.coins_earned, 0) as coins_earned,
                COALESCE(os_today.text_earned, 0) as text_earned,
                COALESCE(os_today.image_earned, 0) as image_earned,
                COALESCE(os_today.audio_earned, 0) as audio_earned,
                COALESCE(os_today.gift_earned, 0) as gift_earned,
                CURRENT_DATE as date
            FROM users u
            LEFT JOIN LATERAL (
                SELECT 
                    SUM(messages_sent) as messages_sent,
                    SUM(coins_earned) as coins_earned,
                    SUM(text_earned) as text_earned,
                    SUM(image_earned) as image_earned,
                    SUM(audio_earned) as audio_earned,
                    SUM(gift_earned) as gift_earned
                FROM operator_stats
                WHERE operator_id::text = u.id::text AND date = CURRENT_DATE
            ) os_today ON TRUE
            WHERE u.role IN ('operator', 'moderator', 'admin', 'super_admin', 'staff')
            ORDER BY messages_today DESC, messages_week DESC
        `;
        const res = await db.query(query);
        console.log('Result count:', res.rows.length);
        console.log('Top 3:', res.rows.slice(0, 3));
    } catch (e) {
        console.error('Query error:', e);
    } finally {
        process.exit(0);
    }
}

testFullQuery();
