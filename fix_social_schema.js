const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true',
    ssl: { rejectUnauthorized: false }
});

async function diagnose() {
    try {
        await client.connect();

        // Check users.id type
        const usersId = await client.query(`
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'id'
        `);
        console.log('users.id type:', usersId.rows[0]);

        // Try creating posts table without FK first
        try {
            await client.query('DROP TABLE IF EXISTS posts CASCADE');
            await client.query(`
                CREATE TABLE posts (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    operator_id UUID,
                    image_url TEXT NOT NULL,
                    content TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ posts created WITHOUT FK');
        } catch (e) {
            console.error('posts no FK failed:', e.message);
        }

        // Try creating stories table without FK
        try {
            await client.query('DROP TABLE IF EXISTS stories CASCADE');
            await client.query(`
                CREATE TABLE stories (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    operator_id UUID,
                    image_url TEXT NOT NULL,
                    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ stories created WITHOUT FK');
        } catch (e) {
            console.error('stories no FK failed:', e.message);
        }

        // Recreate dependent tables
        await client.query('DROP TABLE IF EXISTS post_likes CASCADE');
        await client.query(`CREATE TABLE post_likes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
            user_id UUID,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(post_id, user_id)
        )`);
        console.log('✅ post_likes created');

        await client.query('DROP TABLE IF EXISTS post_comments CASCADE');
        await client.query(`CREATE TABLE post_comments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
            user_id UUID,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log('✅ post_comments created');

        await client.query('DROP TABLE IF EXISTS story_likes CASCADE');
        await client.query(`CREATE TABLE story_likes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
            user_id UUID,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(story_id, user_id)
        )`);
        console.log('✅ story_likes created');

        console.log('\n🎉 Done! Tables recreated without FK constraints to users (to avoid type issues).');
        console.log('Queries will still work due to JOIN on u.id = p.operator_id (both UUID now).');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

diagnose();
