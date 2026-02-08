const db = require('./db');

const sanitizeUser = (user, req) => {
    if (!user) return null;
    const protocol = 'http';
    const host = 'localhost:3000';

    const newUser = { ...user };
    if (newUser.avatar_url && !newUser.avatar_url.startsWith('http')) {
        newUser.avatar_url = `${protocol}://${host}${newUser.avatar_url.startsWith('/') ? '' : '/'}${newUser.avatar_url}`;
    }
    newUser.onboarding_completed = !!user.onboarding_completed;
    if (newUser.photos && Array.isArray(newUser.photos)) {
        newUser.photos = newUser.photos.map(p => {
            if (p && !p.startsWith('http')) {
                return `${protocol}://${host}${p.startsWith('/') ? '' : '/'}${p}`;
            }
            return p;
        });
    }
    return newUser;
};

async function debug() {
    try {
        console.log('Testing Stories Query...');
        const storiesRes = await db.query(`
            SELECT s.*, u.display_name as name, u.avatar_url as avatar, u.vip_level as level
            FROM stories s
            JOIN users u ON s.operator_id = u.id
            WHERE s.expires_at > NOW()
            ORDER BY s.created_at DESC
        `);
        console.log('Stories found:', storiesRes.rows.length);
        storiesRes.rows.map(s => sanitizeUser(s, { protocol: 'http', get: () => 'localhost' }));

        console.log('Testing Posts Query...');
        const postsRes = await db.query(`
            SELECT p.*, u.display_name as userName, u.avatar_url as avatar, u.job as jobTitle, u.vip_level as level
            FROM posts p
            JOIN users u ON p.operator_id = u.id
            ORDER BY p.created_at DESC
            LIMIT 50
        `);
        console.log('Posts found:', postsRes.rows.length);
        postsRes.rows.map(p => sanitizeUser(p, { protocol: 'http', get: () => 'localhost' }));

        console.log('SUCCESS: All queries and sanitization worked.');
        process.exit(0);
    } catch (err) {
        console.error('DEBUG FAILED!');
        console.error('Message:', err.message);
        console.error('Stack:', err.stack);
        process.exit(1);
    }
}

debug();
