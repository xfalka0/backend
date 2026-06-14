const db = require('./db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

async function seed() {
    try {
        console.log('--- Reading Schema ---');
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

        console.log('--- Creating Tables (If not exist) ---');
        try {
            await db.query(schemaSql);
        } catch (e) {
            console.log('[Seed] Schema initialization warning (types might already exist):', e.message);
        }

        // Run Phase 1 Migration to ensure the columns exist in current database connection
        console.log('--- Applying Phase 1 Database Migrations ---');
        const migrationSql = fs.readFileSync(path.join(__dirname, 'db/phase1_migration.sql'), 'utf8');
        await db.query(migrationSql);

        console.log('--- Seeding Phase 1 Users & Data ---');
        
        const hashedPass = await bcrypt.hash('pass123', 10);

        // 1. Create Admin User
        const adminRes = await db.query(`
            INSERT INTO users (username, email, password_hash, role, display_name, status, level)
            VALUES ('admin', 'admin@example.com', $1, 'admin', 'Sistem Yöneticisi', 'active', 99)
            ON CONFLICT (username) DO UPDATE SET password_hash = $1, role = 'admin'
            RETURNING id;
        `, [hashedPass]);
        console.log('[Seed] Created Admin User');

        // 2. Create Host (Operator) User
        const hostRes = await db.query(`
            INSERT INTO users (username, email, password_hash, role, display_name, gender, avatar_url, bio, status, level)
            VALUES ('host_sarah', 'host@example.com', $1, 'operator', 'Sarah (Yayıncı)', 'kadin', 'https://randomuser.me/api/portraits/women/44.jpg', 'Merhaba! Keyifli sohbetler için buradayım.', 'active', 5)
            ON CONFLICT (username) DO UPDATE SET password_hash = $1, role = 'operator', gender = 'kadin'
            RETURNING id;
        `, [hashedPass]);
        
        const hostId = hostRes.rows[0]?.id;
        if (hostId) {
            await db.query(`
                INSERT INTO operators (user_id, category, is_online, bio, rating)
                VALUES ($1, 'Friendly', true, 'Merhaba! Keyifli sohbetler için buradayım.', 5.0)
                ON CONFLICT (user_id) DO UPDATE SET is_online = true;
            `, [hostId]);
        }
        console.log('[Seed] Created Host (Operator) User');

        // 3. Create Normal User
        await db.query(`
            INSERT INTO users (username, email, password_hash, role, display_name, status, level, coin_balance, balance)
            VALUES ('testuser', 'user@test.com', $1, 'user', 'Normal Üye', 'active', 1, 100, 100)
            ON CONFLICT (username) DO UPDATE SET password_hash = $1, role = 'user';
        `, [hashedPass]);
        console.log('[Seed] Created Normal User');

        // 4. Create Coin Rich User
        await db.query(`
            INSERT INTO users (username, email, password_hash, role, display_name, status, level, coin_balance, balance)
            VALUES ('rich_guy', 'rich@example.com', $1, 'user', 'Vip Üye (Zengin)', 'active', 10, 50000, 50000)
            ON CONFLICT (username) DO UPDATE SET password_hash = $1, coin_balance = 50000, balance = 50000;
        `, [hashedPass]);
        console.log('[Seed] Created Coin Rich User');

        // 5. Create Gifts
        await db.query(`
            INSERT INTO gifts (id, name, cost, icon_url)
            VALUES 
                (1, 'Rose', 10, '🌹'),
                (2, 'Heart', 50, '❤️'),
                (3, 'Diamond', 500, '💎')
            ON CONFLICT (id) DO NOTHING;
        `);
        console.log('[Seed] Seeded Gifts');

        // 6. Create Fake Videos (Stubs) for Sarah
        if (hostId) {
            await db.query(`
                INSERT INTO fake_videos (operator_id, video_url, title, duration_sec)
                VALUES ($1, 'https://www.w3schools.com/html/mov_bbb.mp4', 'Welcome Video', 10)
                ON CONFLICT DO NOTHING;
            `, [hostId]);
            console.log('[Seed] Created Fake Videos stubs');
        }

        console.log('--- Seeding Complete ---');
        process.exit(0);

    } catch (err) {
        console.error('Seeding Error:', err);
        process.exit(1);
    }
}

seed();
