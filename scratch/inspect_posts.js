const db = require('../db');

async function inspect() {
    try {
        console.log('--- DB DIAGNOSTIC ---');
        
        // 1. Get user 591 details
        const userRes = await db.query("SELECT id, username, email, role, gender, vip_level FROM users WHERE id::text = '591' OR username = '591'");
        console.log('User 591 details:', userRes.rows);
        
        // If not found, show some users
        if (userRes.rows.length === 0) {
            const usersSample = await db.query("SELECT id, username, email, role, gender, vip_level FROM users LIMIT 10");
            console.log('Sample users in DB:', usersSample.rows);
        }

        // 2. Check all posts and their authors
        const postsRes = await db.query(`
            SELECT p.id as post_id, p.operator_id, p.image_url, p.content, 
                   u.username, u.gender, u.role, u.vip_level 
            FROM posts p
            LEFT JOIN users u ON p.operator_id = u.id
        `);
        console.log(`Total Posts in DB: ${postsRes.rows.length}`);
        console.log('Posts details:', postsRes.rows);

        // 3. Check all stories and their authors
        const storiesRes = await db.query(`
            SELECT s.id as story_id, s.operator_id, s.image_url, 
                   u.username, u.gender, u.role, u.vip_level 
            FROM stories s
            LEFT JOIN users u ON s.operator_id = u.id
        `);
        console.log(`Total Stories in DB: ${storiesRes.rows.length}`);
        console.log('Stories details:', storiesRes.rows);

        process.exit(0);
    } catch (err) {
        console.error('Diagnostic error:', err);
        process.exit(1);
    }
}

inspect();
