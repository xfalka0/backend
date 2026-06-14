const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true',
    ssl: { rejectUnauthorized: false }
});

async function inspect() {
    try {
        await client.connect();
        console.log('Connected to Render Database successfully!');

        // 1. Get user 591 details
        const userRes = await client.query("SELECT id, username, email, role, gender, vip_level FROM users WHERE id::text = '591' OR username = '591' OR id::text LIKE '%591%'");
        console.log('User 591 details:', userRes.rows);
        
        // If not found, try searching by numeric id if it exists, or display some sample users
        const usersCount = await client.query("SELECT COUNT(*) FROM users");
        console.log('Total users in Render DB:', usersCount.rows[0].count);

        // Let's find any user matching a part of the ID, or look for user with id 591
        const find591 = await client.query("SELECT id, username, email, role, gender, vip_level FROM users WHERE id::text = '591' OR id::text LIKE '%591'");
        console.log('Search for 591 in Render DB:', find591.rows);

        if (find591.rows.length === 0) {
            // Let's list the first 5 users
            const sampleUsers = await client.query("SELECT id, username, email, role, gender, vip_level FROM users LIMIT 5");
            console.log('Sample users in Render DB:', sampleUsers.rows);
        }

        // 2. Check posts in Render DB
        const postsCount = await client.query("SELECT COUNT(*) FROM posts");
        console.log('Total Posts in Render DB:', postsCount.rows[0].count);

        const postsRes = await client.query(`
            SELECT p.id as post_id, p.operator_id, p.image_url, p.content, 
                   u.username, u.gender, u.role, u.vip_level 
            FROM posts p
            LEFT JOIN users u ON p.operator_id = u.id
            LIMIT 10
        `);
        console.log('Sample posts details:', postsRes.rows);

        // 3. Check stories in Render DB
        const storiesCount = await client.query("SELECT COUNT(*) FROM stories");
        console.log('Total Stories in Render DB:', storiesCount.rows[0].count);

        const storiesRes = await client.query(`
            SELECT s.id as story_id, s.operator_id, s.image_url, 
                   u.username, u.gender, u.role, u.vip_level 
            FROM stories s
            LEFT JOIN users u ON s.operator_id = u.id
            LIMIT 10
        `);
        console.log('Sample stories details:', storiesRes.rows);

        await client.end();
    } catch (err) {
        console.error('Inspection failed:', err);
    }
}

inspect();
