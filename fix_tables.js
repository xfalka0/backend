const db = require('./db');

async function fix() {
    try {
        console.log('--- 🛠️  DATABASE TABLE FIX START ---');

        // Ensure pgcrypto for gen_random_uuid()
        console.log('1. Checking pgcrypto extension...');
        await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
        console.log('✅ pgcrypto ready.');

        // Create posts table
        console.log('2. Creating posts table...');
        await db.query(`CREATE TABLE IF NOT EXISTS posts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            operator_id UUID REFERENCES users(id),
            image_url TEXT NOT NULL,
            content TEXT,
            likes_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        )`);
        console.log('✅ posts table ready.');

        // Create stories table
        console.log('3. Creating stories table...');
        await db.query(`CREATE TABLE IF NOT EXISTS stories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            operator_id UUID REFERENCES users(id),
            image_url TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
        )`);
        console.log('✅ stories table ready.');

        // Create post_likes table
        console.log('4. Creating post_likes table...');
        await db.query(`CREATE TABLE IF NOT EXISTS post_likes (
            post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            PRIMARY KEY (post_id, user_id)
        )`);
        console.log('✅ post_likes table ready.');

        console.log('--- 🎉 DATABASE TABLE FIX COMPLETE ---');
        process.exit(0);
    } catch (err) {
        console.error('--- ❌ FIX FAILED ---');
        console.error('Error:', err.message);
        process.exit(1);
    }
}

fix();
