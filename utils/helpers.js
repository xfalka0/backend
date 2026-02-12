const db = require('../db');

const sanitizeUser = (user, req) => {
    if (!user) return null;
    // Force HTTPS on Render or if x-forwarded-proto is https
    let protocol = 'http';
    if (req.get && (req.get('host').includes('onrender.com') || req.headers['x-forwarded-proto'] === 'https')) {
        protocol = 'https';
    } else {
        protocol = req?.protocol || 'http';
    }
    const host = (req?.get ? req.get('host') : null) || 'localhost:3000';

    const newUser = { ...user };

    const rewrite = (url) => {
        if (url && typeof url === 'string' && !url.startsWith('http')) {
            return `${protocol}://${host}${url.startsWith('/') ? '' : '/'}${url}`;
        }
        return url;
    };

    // Rewrite common image fields
    if (newUser.avatar_url) newUser.avatar_url = rewrite(newUser.avatar_url);
    if (newUser.avatar) newUser.avatar = rewrite(newUser.avatar);
    if (newUser.image_url) newUser.image_url = rewrite(newUser.image_url);
    if (newUser.image) newUser.image = rewrite(newUser.image);

    // Pass through onboarding status
    if (user.onboarding_completed !== undefined) {
        newUser.onboarding_completed = !!user.onboarding_completed;
    }

    // Rewrite Photos array if exists (for operators)
    if (newUser.photos && Array.isArray(newUser.photos)) {
        newUser.photos = newUser.photos.map(p => rewrite(p));
    }

    return newUser;
};

// Helper: Log Activity & Emit Socket Event
const logActivity = async (io, userId, actionType, description) => {
    try {
        // 1. Insert into DB
        const result = await db.query(
            'INSERT INTO activities (user_id, action_type, description) VALUES ($1, $2, $3) RETURNING *',
            [userId, actionType, description]
        );

        // 2. Fetch User Details for UI
        const act = result.rows[0];
        const userRes = await db.query('SELECT username, avatar_url FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0] || { username: 'Unknown', avatar_url: '' };

        const fullActivity = { ...act, user_name: user.username, user_avatar: user.avatar_url };

        // 3. Emit Real-time Event if io is provided
        if (io) {
            io.emit('new_activity', fullActivity);
        }

        return fullActivity;
    } catch (err) {
        console.error("Log Activity Error:", err.message);
    }
};

module.exports = {
    sanitizeUser,
    logActivity
};
