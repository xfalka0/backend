const db = require('./db');
const fs = require('fs');
const path = require('path');

async function seed() {
    try {
        console.log('--- Reading Schema ---');
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

        console.log('--- Creating Tables ---');
        await db.query(schemaSql);

        console.log('--- Seeding Data ---');

        // 1. Create Admin
        await db.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES 
      ('admin', 'admin@example.com', 'hashed_pass_123', 'admin')
      ON CONFLICT (email) DO NOTHING;
    `);

        // 2. Create Operators
        const ops = [
            { name: 'Sarah', email: 'sarah@op.com', cat: 'Friendly', bio: 'I love to listen!', img: 'https://randomuser.me/api/portraits/women/44.jpg' },
            { name: 'Jessica', email: 'jessica@op.com', cat: 'Flirty', bio: 'Lets have fun!', img: 'https://randomuser.me/api/portraits/women/68.jpg' },
            { name: 'Emily', email: 'emily@op.com', cat: 'Advisor', bio: 'Here for you.', img: 'https://randomuser.me/api/portraits/women/65.jpg' }
        ];

        for (const op of ops) {
            const res = await db.query(`
        INSERT INTO users (username, email, password_hash, role, avatar_url)
        VALUES ($1, $2, 'pass123', 'operator', $3)
        ON CONFLICT (email) DO UPDATE SET avatar_url = $3
        RETURNING id;
      `, [op.name, op.email, op.img]);

            const userId = res.rows[0]?.id;
            if (userId) {
                await db.query(`
          INSERT INTO operators (user_id, category, is_online, bio)
          VALUES ($1, $2, true, $3)
          ON CONFLICT (user_id) DO NOTHING;
        `, [userId, op.cat, op.bio]);
            }
        }

        // 3. Create Dummy User
        await db.query(`
      INSERT INTO users (username, email, password_hash, role, balance, is_vip)
      VALUES ('testuser', 'user@test.com', 'pass123', 'user', 100, true)
      ON CONFLICT (email) DO NOTHING;
    `);

        // 4. Create Gifts
        await db.query(`
      INSERT INTO gifts (name, cost, icon_url)
      VALUES 
        ('Rose', 10, '🌹'),
        ('Heart', 50, '❤️'),
        ('Diamond', 500, '💎')
      ON CONFLICT DO NOTHING;
    `);

        // 5. Create Fake Videos (Stubs)
        // In a real app, these would be local file paths or S3 URLs
        const opUsers = await db.query("SELECT id FROM users WHERE role = 'operator'");
        for (const row of opUsers.rows) {
            await db.query(`
         INSERT INTO fake_videos (operator_id, video_url, title, duration_sec)
         VALUES ($1, 'https://www.w3schools.com/html/mov_bbb.mp4', 'Welcome Video', 10)
       `, [row.id]);
        }

        console.log('--- Seeding Complete ---');
        process.exit(0);

    } catch (err) {
        console.error('Seeding Error:', err);
        process.exit(1);
    }
}

seed();
