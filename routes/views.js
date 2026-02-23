const express = require('express');
const router = express.Router();
const pool = require('../db');

// Track a profile view
router.post('/', async (req, res) => {
    const { viewerId, viewedUserId } = req.body;
    try {
        if (!viewerId || !viewedUserId) {
            return res.status(400).json({ error: 'Missing viewerId or viewedUserId' });
        }
        if (viewerId === viewedUserId) {
            return res.status(200).json({ message: 'Own profile viewed' });
        }

        // To prevent spamming, we could check if a view already happened in the last X minutes.
        // For simplicity, we just insert every time they view it, or we could upsert. Let's just insert.
        await pool.query(
            'INSERT INTO profile_views (viewer_id, viewed_user_id) VALUES ($1, $2)',
            [viewerId, viewedUserId]
        );

        res.status(201).json({ message: 'Profile view tracked' });
    } catch (err) {
        console.error('Track View Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get users who viewed me
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const userCheck = await pool.query(
            'SELECT is_vip, vip_expire_date FROM users WHERE id = $1',
            [userId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userCheck.rows[0];
        const now = new Date();
        const expireDate = new Date(user.vip_expire_date);
        const isVIP = user.is_vip && (expireDate > now || !user.vip_expire_date);

        // Get unique recent visitors
        const views = await pool.query(`
            SELECT DISTINCT ON (v.viewer_id) 
                   v.id as view_id, u.id, u.username, u.avatar_url, u.gender, v.created_at,
                   o.is_online
            FROM profile_views v
            JOIN users u ON v.viewer_id = u.id
            LEFT JOIN operators o ON u.id = o.user_id
            WHERE v.viewed_user_id = $1
            ORDER BY v.viewer_id, v.created_at DESC
        `, [userId]);

        // Then order by time DESC in JS or with subquery
        const sortedViews = views.rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const processedViews = sortedViews.map(view => {
            if (isVIP) {
                return view;
            } else {
                return {
                    id: view.id,
                    username: 'Gizli Kullanıcı',
                    avatar_url: view.avatar_url, // For blur
                    gender: view.gender,
                    created_at: view.created_at,
                    is_online: false,
                    is_blurred: true
                };
            }
        });

        res.json({
            isVIP: isVIP,
            visitors: processedViews
        });
    } catch (err) {
        console.error('Get Visitors Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
