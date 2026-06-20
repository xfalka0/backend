const { pool } = require('../db');

async function migrate() {
    console.log('[MIGRATION] Starting nobility system database migration...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create nobility_titles table
        await client.query(`
            CREATE TABLE IF NOT EXISTS nobility_titles (
                id SERIAL PRIMARY KEY,
                key VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                level INT UNIQUE NOT NULL,
                price INT NOT NULL,
                duration_days INT NOT NULL DEFAULT 30,
                badge_url TEXT,
                name_color VARCHAR(30),
                priority_weight INT DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create user_nobility table
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_nobility (
                id SERIAL PRIMARY KEY,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                title_id INT REFERENCES nobility_titles(id) ON DELETE CASCADE,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                purchased_price INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes on user_nobility
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_user_nobility_user_id ON user_nobility(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_nobility_is_active ON user_nobility(is_active);
        `);

        // Create nobility_purchase_logs table
        await client.query(`
            CREATE TABLE IF NOT EXISTS nobility_purchase_logs (
                id SERIAL PRIMARY KEY,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                title_id INT REFERENCES nobility_titles(id) ON DELETE CASCADE,
                price INT NOT NULL,
                purchase_type VARCHAR(50) NOT NULL, -- new_purchase | renew | upgrade
                old_title_id INT REFERENCES nobility_titles(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Seed default titles
        const seedTitles = [
            {
                key: "knight",
                name: "Şövalye",
                level: 1,
                price: 2999,
                duration_days: 30,
                badge_url: "https://i.postimg.cc/k5zTq46q/knight.png",
                name_color: "#A7C7FF",
                priority_weight: 10
            },
            {
                key: "baron",
                name: "Baron",
                level: 2,
                price: 4999,
                duration_days: 30,
                badge_url: "https://i.postimg.cc/zXhQWJ3Y/baron.png",
                name_color: "#B46CFF",
                priority_weight: 20
            },
            {
                key: "king",
                name: "Kral",
                level: 3,
                price: 12999,
                duration_days: 30,
                badge_url: "https://i.postimg.cc/NfvN49Z1/king.png",
                name_color: "#FFD166",
                priority_weight: 40
            },
            {
                key: "duke",
                name: "Dük",
                level: 4,
                price: 29999,
                duration_days: 30,
                badge_url: "https://i.postimg.cc/6qW8dK1k/duke.png",
                name_color: "#FF4D8D",
                priority_weight: 70
            },
            {
                key: "emperor",
                name: "İmparator",
                level: 5,
                price: 49999,
                duration_days: 30,
                badge_url: "https://i.postimg.cc/0j1tqjD3/emperor.png",
                name_color: "#FFB84D",
                priority_weight: 100
            }
        ];

        for (const title of seedTitles) {
            await client.query(`
                INSERT INTO nobility_titles (key, name, level, price, duration_days, badge_url, name_color, priority_weight, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
                ON CONFLICT (key) DO UPDATE SET
                    name = EXCLUDED.name,
                    level = EXCLUDED.level,
                    price = EXCLUDED.price,
                    duration_days = EXCLUDED.duration_days,
                    badge_url = EXCLUDED.badge_url,
                    name_color = EXCLUDED.name_color,
                    priority_weight = EXCLUDED.priority_weight
            `, [title.key, title.name, title.level, title.price, title.duration_days, title.badge_url, title.name_color, title.priority_weight]);
        }

        await client.query('COMMIT');
        console.log('[MIGRATION] Nobility tables migrated and seeded successfully.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[MIGRATION] Nobility migration failed:', e.message);
    } finally {
        client.release();
    }
}

migrate().then(() => process.exit(0));
