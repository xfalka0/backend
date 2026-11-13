const fs = require('fs');
const path = 'd:/dating/backend/routes/favorites.js';
let s = fs.readFileSync(path, 'utf8');

const targetStr = "router.get('/:userId/fans', async (req, res) => {";
const replacementStr = `// Centralized VIP fans check
router.get('/:userId/fans', authenticateToken, async (req, res) => {
    const { userId } = req.params;

    if (req.user.id.toString() !== userId.toString() && req.user.role !== 'admin' && req.user.role !== 'super_admin' && req.user.role !== 'operator') {
        return res.status(403).json({ error: 'Yetkisiz işlem.' });
    }

    try {
        const userCheck = await pool.query(
            'SELECT id, role, is_vip, vip_expire_date, gender, vip_level FROM users WHERE id::text = $1::text',
            [userId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userCheck.rows[0];
        const isVip = isUserVipActive(user);

        const fans = await pool.query(\`
            SELECT u.id, COALESCE(u.display_name, u.username) as name, u.username, u.avatar_url, u.gender, u.is_vip, f.created_at,
                   o.is_online
            FROM favorites f
            JOIN users u ON f.user_id::text = u.id::text
            LEFT JOIN operators o ON u.id::text = o.user_id::text
            WHERE f.target_user_id::text = $1::text
            ORDER BY f.created_at DESC
        \`, [userId]);

        const allFans = fans.rows;
        const sortedFans = allFans.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const processedFans = sortedFans.map(fan => {
            if (isVip) {
                return fan;
            } else {
                return {
                    id: fan.id,
                    name: 'Gizli Kullanıcı',
                    username: 'Gizli Kullanıcı',
                    avatar_url: null,
                    gender: fan.gender,
                    created_at: fan.created_at,
                    is_online: false,
                    is_blurred: true
                };
            }
        });

        res.json({
            isVIP: isVip,
            vipLevel: parseInt(user.vip_level || 0, 10),
            fans: processedFans
        });
    } catch (err) {
        console.error('Get Fans Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});`;

const startIdx = s.indexOf(targetStr);
const endIdx = s.indexOf('module.exports = router;', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  s = s.slice(0, startIdx) + replacementStr + '\n\n' + s.slice(endIdx);
  fs.writeFileSync(path, s, 'utf8');
  console.log('Successfully replaced fans handler in favorites.js');
} else {
  console.error('Could not find start/end idx');
}
