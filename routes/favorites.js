const express = require('express');
const router = express.Router();
const pool = require('../db');

// Add a user to favorites
router.post('/', async (req, res) => {
    const { userId, targetUserId } = req.body;
    try {
        if (!userId || !targetUserId) {
            return res.status(400).json({ error: 'Missing userId or targetUserId' });
        }
        if (userId === targetUserId) {
            return res.status(400).json({ error: 'Cannot favorite yourself' });
        }

        const newFav = await pool.query(
            'INSERT INTO favorites (user_id, target_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *',
            [userId, targetUserId]
        );

        if (newFav.rows.length === 0) {
            return res.status(400).json({ error: 'Already favorited or action failed' });
        }

        res.status(201).json({ message: 'Added to favorites', favorite: newFav.rows[0] });
    } catch (err) {
        console.error('Add Favorite Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Remove a user from favorites
router.delete('/:targetUserId', async (req, res) => {
    const { targetUserId } = req.params;
    const { userId } = req.body; // or req.query if it's a GET, but DELETE usually has query or body. Let's assume passed in query or body.
    // Actually, passing userId in body for DELETE is fine, but some clients drop it. Let's check headers or query.
    const uid = req.body.userId || req.query.userId;

    try {
        if (!uid || !targetUserId) {
            return res.status(400).json({ error: 'Missing userId or targetUserId' });
        }

        await pool.query(
            'DELETE FROM favorites WHERE user_id = $1 AND target_user_id = $2',
            [uid, targetUserId]
        );

        res.json({ message: 'Removed from favorites' });
    } catch (err) {
        console.error('Remove Favorite Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Check if a specific user is favorited by the current user
router.get('/check/:userId/:targetUserId', async (req, res) => {
    const { userId, targetUserId } = req.params;
    try {
        const check = await pool.query(
            'SELECT id FROM favorites WHERE user_id = $1 AND target_user_id = $2',
            [userId, targetUserId]
        );
        res.json({ isFavorited: check.rows.length > 0 });
    } catch (err) {
        console.error('Check Favorite Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get users I have favorited
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const favorites = await pool.query(`
            SELECT u.id, u.username, u.avatar_url, u.gender, u.job, u.is_vip,
                   o.is_online
            FROM favorites f
            JOIN users u ON f.target_user_id = u.id
            LEFT JOIN operators o ON u.id = o.user_id
            WHERE f.user_id = $1
            ORDER BY f.created_at DESC
        `, [userId]);

        res.json(favorites.rows);
    } catch (err) {
        console.error('Get Favorites Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get users who favorited me (Fans)
router.get('/:userId/fans', async (req, res) => {
    const { userId } = req.params;
    try {
        // First, check if the requested user is VIP
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
        const isVIP = user.is_vip && (expireDate > now || !user.vip_expire_date); // Logic: if is_vip is true and not expired

        const fans = await pool.query(`
            SELECT u.id, u.username, u.avatar_url, u.gender, f.created_at,
                   o.is_online
            FROM favorites f
            JOIN users u ON f.user_id = u.id
            LEFT JOIN operators o ON u.id = o.user_id
            WHERE f.target_user_id = $1
            ORDER BY f.created_at DESC
        `, [userId]);

        // If not VIP, obscure the data
        const processedFans = fans.rows.map(fan => {
            if (isVIP) {
                return fan;
            } else {
                return {
                    id: fan.id,
                    username: 'Gizli Kullanıcı',
                    avatar_url: fan.avatar_url, // Let frontend blur it
                    gender: fan.gender,
                    created_at: fan.created_at,
                    is_online: false,
                    is_blurred: true // flag for frontend
                };
            }
        });

        res.json({
            isVIP: isVIP,
            fans: processedFans
        });
    } catch (err) {
        console.error('Get Fans Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
