const pool = require('./db');

async function updateSchema() {
    try {
        console.log('Starting Phase 3 Schema Update...');

        // 1. Add vip_expire_date to users
        console.log('Adding vip_expire_date to users table...');
        try {
            await pool.query('ALTER TABLE users ADD COLUMN vip_expire_date TIMESTAMP');
            console.log('Column vip_expire_date added successfully.');
        } catch (e) {
            if (e.code === '42701') { // 42701: duplicate_column
                console.log('Column vip_expire_date already exists. Skipping.');
            } else {
                throw e;
            }
        }

        // 2. Create favorites table
        console.log('Creating favorites table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS favorites (
                id SERIAL PRIMARY KEY,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, target_user_id)
            );
        `);
        console.log('favorites table ready.');

        // 3. Create profile_views table
        console.log('Creating profile_views table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS profile_views (
                id SERIAL PRIMARY KEY,
                viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
                viewed_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('profile_views table ready.');

        // 4. Create boosts table
        console.log('Creating boosts table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS boosts (
                id SERIAL PRIMARY KEY,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP NOT NULL
            );
        `);
        console.log('boosts table ready.');

        console.log('Phase 3 Schema Update Completed Successfully!');
        process.exit(0);

    } catch (error) {
        console.error('Error during schema update:', error);
        process.exit(1);
    }
}

updateSchema();
