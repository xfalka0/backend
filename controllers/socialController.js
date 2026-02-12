const db = require('../db');
const { sanitizeUser } = require('../utils/helpers');
const fs = require('fs');
const path = require('path');

// GET EXPLORE DATA (Stories & Posts)
exports.getExplore = async (req, res) => {
    try {
        // Fetch active stories
        let stories = [];
        try {
            const storiesRes = await db.query(`
                SELECT s.*, u.display_name as name, u.avatar_url as avatar, u.vip_level as level,
                EXISTS(SELECT 1 FROM stories s2 WHERE s2.operator_id = u.id AND s2.expires_at > NOW()) as "hasStory"
                FROM stories s
                JOIN users u ON s.operator_id = u.id
                WHERE s.expires_at > NOW()
                ORDER BY s.created_at DESC
            `);
            stories = storiesRes.rows.map(s => sanitizeUser(s, req));
        } catch (sErr) {
            console.error('[SOCIAL] Stories Fetch Error:', sErr.message);
        }

        // Fetch latest posts with like counts and user like status
        let posts = [];
        const currentUserId = req.query.user_id;
        try {
            const postsRes = await db.query(`
                SELECT 
                    p.*, 
                    u.display_name as "userName", 
                    u.avatar_url as avatar, 
                    COALESCE(op.category, u.job) as "jobTitle", 
                    u.vip_level as level, 
                    u.age, 
                    u.gender,
                    (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as "likes_count",
                    CASE WHEN $1::UUID IS NOT NULL AND EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1::UUID) THEN true ELSE false END as "liked",
                    EXISTS(SELECT 1 FROM stories s WHERE s.operator_id = u.id AND s.expires_at > NOW()) as "hasStory"
                FROM posts p
                JOIN users u ON p.operator_id = u.id
                LEFT JOIN operators op ON u.id = op.user_id
                ORDER BY p.created_at DESC
                LIMIT 50
            `, [currentUserId]);
            posts = postsRes.rows.map(p => sanitizeUser(p, req));
        } catch (pErr) {
            console.error('[SOCIAL] Posts Fetch Error:', pErr.message);
            posts = [{
                id: 'debug-error-' + Date.now(),
                image_url: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=ERROR',
                content: `DEBUG ERROR: ${pErr.message}`,
                userName: 'SYSTEM ERROR',
                avatar: '',
                created_at: new Date()
            }];
        }

        res.json({ stories, posts });
    } catch (err) {
        console.error('[SOCIAL] Critical Explore Error:', err.message);
        res.status(500).json({
            error: 'Keşfet verileri alınamadı.',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// TOGGLE POST LIKE
exports.toggleLike = async (req, res) => {
    const postId = req.params.id;
    const { user_id } = req.body;

    if (!user_id) return res.status(401).json({ error: 'User ID gerekli' });

    try {
        const check = await db.query('SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2', [postId, user_id]);

        if (check.rows.length > 0) {
            await db.query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [postId, user_id]);
            res.json({ liked: false });
        } else {
            await db.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [postId, user_id]);
            res.json({ liked: true });
        }
    } catch (err) {
        console.error('[SOCIAL] Like toggle error:', err.message);
        res.status(500).json({ error: 'Beğeni işlemi başarısız.' });
    }
};

// ADMIN: Create Post
exports.adminCreatePost = async (req, res) => {
    const { operator_id, image_url, content } = req.body;
    const logFile = path.join(__dirname, '../debug_social.log');

    const log = (msg) => {
        const timestamp = new Date().toISOString();
        const logMsg = `[${timestamp}] ${msg}\n`;
        console.log(logMsg.trim());
        try { fs.appendFileSync(logFile, logMsg); } catch (e) { /* ignore */ }
    };

    log(`[REQUEST] /api/admin/social/post - Body: ${JSON.stringify(req.body)}`);

    if (!operator_id || !image_url) {
        log('[ERROR] Missing fields operator_id or image_url');
        return res.status(400).json({ error: 'Operator ve görsel gerekli.' });
    }

    try {
        const result = await db.query(
            'INSERT INTO posts (operator_id, image_url, content) VALUES ($1, $2, $3) RETURNING *',
            [operator_id, image_url, content]
        );
        log(`[SUCCESS] Post Inserted ID: ${result.rows[0].id}`);
        res.json(result.rows[0]);
    } catch (err) {
        log(`[DB ERROR] ${err.message}`);
        res.status(500).json({
            error: 'Veritabanı hatası oluştu.',
            details: err.message
        });
    }
};

// ADMIN: Create Story
exports.adminCreateStory = async (req, res) => {
    const { operator_id, image_url } = req.body;
    if (!operator_id || !image_url) return res.status(400).json({ error: 'Operator ve görsel gerekli.' });
    try {
        const result = await db.query(
            'INSERT INTO stories (operator_id, image_url) VALUES ($1, $2) RETURNING *',
            [operator_id, image_url]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// USER: Create Post
exports.userCreatePost = async (req, res) => {
    const { image_url, content } = req.body;
    const userId = req.user.id;

    if (!image_url) return res.status(400).json({ error: 'Görsel gerekli.' });

    try {
        const result = await db.query(
            'INSERT INTO posts (operator_id, image_url, content) VALUES ($1, $2, $3) RETURNING *',
            [userId, image_url, content]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[SOCIAL] User Create Post Error:', err.message);
        res.status(500).json({ error: 'Paylaşım yapılamadı.' });
    }
};

// USER: Create Story
exports.userCreateStory = async (req, res) => {
    const { image_url } = req.body;
    const userId = req.user.id;

    if (!image_url) return res.status(400).json({ error: 'Görsel gerekli.' });

    try {
        const result = await db.query(
            'INSERT INTO stories (operator_id, image_url) VALUES ($1, $2) RETURNING *',
            [userId, image_url]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[SOCIAL] User Create Story Error:', err.message);
        res.status(500).json({ error: 'Hikaye paylaşılamadı.' });
    }
};

// DELETE Social Content
exports.deleteSocialContent = async (req, res) => {
    const { type, id } = req.params;
    const table = type === 'story' ? 'stories' : 'posts';

    try {
        await db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
