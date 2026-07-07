const express = require('express');
const router = express.Router();
const pool = require('../db');
const { sendPushNotification } = require('../utils/notificationUtils');

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
        console.log(`[VIEWS] Tracking view: ${viewerId} -> ${viewedUserId}`);
        await pool.query(
            'INSERT INTO profile_views (viewer_id, viewed_user_id) VALUES ($1, $2)',
            [viewerId, viewedUserId]
        );

        // Fetch viewer's details
        const viewerRes = await pool.query(
            'SELECT display_name, username, avatar_url FROM users WHERE id = $1',
            [viewerId]
        );
        const viewer = viewerRes.rows[0];
        const viewerName = viewer ? (viewer.display_name || viewer.username) : 'Birisi';
        const viewerAvatar = viewer ? viewer.avatar_url : null;

        // Count unique visitors
        const countRes = await pool.query(
            'SELECT COUNT(DISTINCT viewer_id) FROM profile_views WHERE viewed_user_id = $1',
            [viewedUserId]
        );
        const uniqueVisitorCount = parseInt(countRes.rows[0]?.count || 0);

        // Emit socket event to the recipient if they are online
        const io = req.app.get('io');
        if (io) {
            console.log(`[VIEWS] Emitting socket profile_viewed to room: ${viewedUserId}`);
            io.to(viewedUserId.toString()).emit('profile_viewed', {
                viewerId: viewerId,
                viewerName: viewerName,
                viewerAvatar: viewerAvatar,
                totalViews: uniqueVisitorCount
            });
        }

        // Trigger a push notification (non-blocking)
        sendPushNotification(viewedUserId, {
            title: 'Birisi profilini ziyaret etti',
            body: `${uniqueVisitorCount} kullanıcısı profilini ziyaret etti, gidip göz at ~`,
            data: {
                type: 'profile_view',
                viewerId: viewerId,
                viewerName: viewerName,
                viewerAvatar: viewerAvatar,
                totalViews: uniqueVisitorCount
            }
        }).catch(err => console.error('[VIEWS] Push notification send error:', err.message));

        res.status(201).json({ message: 'Profile view tracked' });
    } catch (err) {
        console.error('------- [TRACK_VIEW_ERROR_DETAILS] -------');
        console.error('Error Message:', err.message);
        console.error('Viewer ID:', viewerId);
        console.error('Viewed User ID:', viewedUserId);
        console.error('Full Error:', err);
        console.error('------------------------------------------');
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// Get users who viewed me (with fake visitor system for male users)
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const userCheck = await pool.query(
            'SELECT is_vip, vip_expire_date, gender, vip_level FROM users WHERE id = $1',
            [userId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userCheck.rows[0];
        const now = new Date();
        const expireDate = new Date(user.vip_expire_date);
        const isLegacyVIP = user.is_vip && (expireDate > now || !user.vip_expire_date);

        // Tiered VIP limits
        const vipLevel = parseInt(user.vip_level || 0, 10);
        let clearCount = 0;
        if (vipLevel === 1) clearCount = 10;
        else if (vipLevel === 2) clearCount = 30;
        else if (vipLevel === 3) clearCount = 50;
        else if (vipLevel === 4) clearCount = 100;
        else if (vipLevel >= 5 || isLegacyVIP) clearCount = Infinity;

        // Get unique recent real visitors
        const views = await pool.query(`
            SELECT DISTINCT ON (v.viewer_id) 
                   v.id as view_id, u.id, u.username, u.avatar_url, u.gender, v.created_at,
                   o.is_online, o.vip_level
            FROM profile_views v
            JOIN users u ON v.viewer_id = u.id
            LEFT JOIN operators o ON u.id = o.user_id
            WHERE v.viewed_user_id = $1
            ORDER BY v.viewer_id, v.created_at DESC
        `, [userId]);

        let fakeVisitors = [];
        
        // Dynamically fetch operators to simulate active visitor engagement
        let opsQuery = `
            SELECT u.id, u.username, u.avatar_url, u.gender, o.is_online, o.vip_level
            FROM users u
            JOIN operators o ON u.id = o.user_id
        `;
        
        if (user.gender && user.gender.toLowerCase() === 'erkek') {
            opsQuery += " WHERE u.gender ILIKE 'kadin'";
        } else if (user.gender && user.gender.toLowerCase() === 'kadin') {
            opsQuery += " WHERE u.gender ILIKE 'erkek'";
        }
        
        opsQuery += " LIMIT 20";

        const opsRes = await pool.query(opsQuery);
        const ops = opsRes.rows;

        if (ops.length > 0) {
            // Deterministic seed based on user ID
            let hash = 0;
            const userIdStr = String(userId);
            for (let i = 0; i < userIdStr.length; i++) {
                hash = userIdStr.charCodeAt(i) + ((hash << 5) - hash);
            }

            const numFake = 5 + (Math.abs(hash) % 3); // 5 to 7 fake visitors
            const today = new Date().toDateString(); // Changes daily

            for (let j = 0; j < numFake; j++) {
                let seed = hash + j + today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const opIndex = Math.abs(seed) % ops.length;
                const op = ops[opIndex];

                    const alreadyExists = views.rows.some(v => v.id === op.id);
                    if (!alreadyExists && !fakeVisitors.some(f => f.id === op.id)) {
                        const minutesAgo = 10 + (Math.abs(seed * 7) % 1400); // 10 mins to ~23 hours ago
                        const fakeTime = new Date(Date.now() - minutesAgo * 60 * 1000);

                        fakeVisitors.push({
                            view_id: `fake-${userId}-${op.id}-${j}`,
                            id: op.id,
                            username: op.username,
                            avatar_url: op.avatar_url,
                            gender: op.gender,
                            created_at: fakeTime.toISOString(),
                            is_online: op.is_online,
                            vip_level: op.vip_level || 0
                        });
                    }
                }
            }
        }

        // Merge and sort all views by created_at DESC
        const allViews = [...views.rows, ...fakeVisitors];
        const sortedViews = allViews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const processedViews = sortedViews.map((view, index) => {
            const isClear = index < clearCount;
            if (isClear) {
                return {
                    ...view,
                    is_blurred: false
                };
            } else {
                return {
                    id: view.id,
                    username: 'Gizli Kullanıcı',
                    avatar_url: view.avatar_url, // Used for the blur image fallback
                    gender: view.gender,
                    created_at: view.created_at,
                    is_online: false,
                    is_blurred: true,
                    vip_level: view.vip_level || 0
                };
            }
        });

        res.json({
            isVIP: vipLevel > 0 || isLegacyVIP,
            vipLevel: vipLevel,
            clearCount: clearCount,
            visitors: processedViews
        });
    } catch (err) {
        console.error('Get Visitors Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get users whom I viewed
router.get('/history/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const views = await pool.query(`
            SELECT DISTINCT ON (v.viewed_user_id) 
                   v.id as view_id, u.id, u.username, u.avatar_url, u.gender, v.created_at,
                   o.is_online
            FROM profile_views v
            JOIN users u ON v.viewed_user_id = u.id
            LEFT JOIN operators o ON u.id = o.user_id
            WHERE v.viewer_id = $1
            ORDER BY v.viewed_user_id, v.created_at DESC
        `, [userId]);

        const sortedViews = views.rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json({
            history: sortedViews
        });
    } catch (err) {
        console.error('Get Viewed History Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
