const { MALE_NAME_PATTERN } = require('../utils/helpers');

const initializeDatabase = async (db, app) => {
    try {
        console.log('[DB] VERIFYING SCHEMA AND INITIALIZING...');

        // 1. Coin Packages Table
        await db.query(`
            CREATE TABLE IF NOT EXISTS coin_packages (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                coins INTEGER NOT NULL,
                icon_url VARCHAR(255),
                revenuecat_id VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                is_popular BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Payments Table
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS payments (
                    id SERIAL PRIMARY KEY,
                    user_id TEXT,
                    package_id INTEGER REFERENCES coin_packages(id),
                    transaction_id VARCHAR(255) UNIQUE,
                    amount DECIMAL(10, 2) NOT NULL,
                    status VARCHAR(50) DEFAULT 'completed',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('[DB] payments table verified');
        } catch (e) { console.error('[DB] Error payments:', e.message); }


        // 3. Transactions Table
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS transactions (
                    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    user_id TEXT,
                    amount INTEGER NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('[DB] transactions table verified');
        } catch (e) { console.error('[DB] Error transactions:', e.message); }

        // 4. Commission Logs Table - FORCE CREATE IMMEDIATELY
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS commission_logs (
                    id SERIAL PRIMARY KEY,
                    operator_id TEXT,
                    chat_id TEXT,
                    amount DECIMAL(10, 2) NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    agency_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('[DB] commission_logs table verified');
        } catch (tableErr) {
            console.error('[DB] Error creating commission_logs table:', tableErr.message);
        }

        // 5. Agencies Table
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS agencies (
                    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    owner_id TEXT,
                    name VARCHAR(255) NOT NULL,
                    commission_rate DECIMAL(5, 2) DEFAULT 0.40,
                    pending_balance DECIMAL(12, 2) DEFAULT 0,
                    lifetime_earnings DECIMAL(12, 2) DEFAULT 0,
                    status VARCHAR(50) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('[DB] agencies table verified');
        } catch (tableErr) {
            console.error('[DB] Error creating agencies table:', tableErr.message);
        }

        // 5.1 Agency Invitations Table
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS agency_invitations (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    agency_id TEXT REFERENCES agencies(id) ON DELETE CASCADE,
                    operator_id TEXT,
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(agency_id, operator_id, status)
                )
            `);
            console.log('[DB] agency_invitations table verified (TEXT operator_id)');
        } catch (tableErr) {
            console.error('[DB] Error creating agency_invitations table:', tableErr.message);
        }

        // 5.2 Agency Applications Table
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS agency_applications (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id TEXT,
                    agency_name VARCHAR(255) NOT NULL,
                    phone VARCHAR(50) NOT NULL,
                    reason TEXT,
                    status VARCHAR(50) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('[DB] agency_applications table verified');
        } catch (tableErr) {
            console.error('[DB] Error creating agency_applications table:', tableErr.message);
        }

        // 6. Referral Clicks Table
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS referral_clicks (
                    id SERIAL PRIMARY KEY,
                    code VARCHAR(50) NOT NULL,
                    ip VARCHAR(50),
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('[DB] referral_clicks table verified');
        } catch (tableErr) {
            console.error('[DB] Error creating referral_clicks table:', tableErr.message);
        }

        // Migration for existing table if types were wrong
        try {
            await db.query('ALTER TABLE commission_logs ALTER COLUMN operator_id TYPE TEXT');
            await db.query('ALTER TABLE commission_logs ALTER COLUMN chat_id TYPE TEXT');
            await db.query('ALTER TABLE commission_logs ADD COLUMN IF NOT EXISTS agency_id TEXT');
            await db.query('ALTER TABLE commission_logs ADD COLUMN IF NOT EXISTS is_low_quality BOOLEAN DEFAULT FALSE');
            await db.query('ALTER TABLE agencies ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE');
        } catch (e) { console.error('[DB] Error in schema migrations:', e.message); }

        // Agency Invitations Migration to TEXT operator_id
        try {
            await db.query('ALTER TABLE agency_invitations DROP CONSTRAINT IF EXISTS agency_invitations_operator_id_fkey');
            await db.query('ALTER TABLE agency_invitations DROP CONSTRAINT IF EXISTS agency_invitations_agency_id_operator_id_status_key');
            await db.query('ALTER TABLE agency_invitations ALTER COLUMN operator_id TYPE TEXT USING operator_id::text');
            await db.query('ALTER TABLE agency_invitations ADD CONSTRAINT agency_invitations_agency_id_operator_id_status_key UNIQUE(agency_id, operator_id, status)');
            console.log('[DB] agency_invitations operator_id migration completed successfully');
        } catch (e) {
            console.error('[DB] Migration Error (agency_invitations operator_id):', e.message);
        }

        try {
            await db.query('ALTER TABLE users ALTER COLUMN balance TYPE INTEGER USING balance::integer');
        } catch (e) { 
            console.error('[DB] Migration Error (users balance):', e.message);
        }
        const getColumns = async (table) => {
            const res = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1", [table]);
            return res.rows.map(c => c.column_name);
        };

        // --- Coin Packages Migrations ---
        const pkgCols = await getColumns('coin_packages');
        if (!pkgCols.includes('revenuecat_id')) await db.query('ALTER TABLE coin_packages ADD COLUMN revenuecat_id VARCHAR(255)');
        if (!pkgCols.includes('is_popular')) await db.query('ALTER TABLE coin_packages ADD COLUMN is_popular BOOLEAN DEFAULT FALSE');
        if (!pkgCols.includes('description')) await db.query('ALTER TABLE coin_packages ADD COLUMN description TEXT');

        // --- Transactions Migrations ---
        const txnCols = await getColumns('transactions');
        if (!txnCols.includes('type')) {
            console.log('[DB] Adding missing column: type to transactions');
            await db.query('ALTER TABLE transactions ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT \'unknown\'');
            await db.query('ALTER TABLE transactions ALTER COLUMN type DROP DEFAULT');
        }
        if (!txnCols.includes('description')) await db.query('ALTER TABLE transactions ADD COLUMN description TEXT');
        if (!txnCols.includes('user_id')) await db.query('ALTER TABLE transactions ADD COLUMN user_id UUID REFERENCES users(id)');
        if (!txnCols.includes('amount')) await db.query('ALTER TABLE transactions ADD COLUMN amount INTEGER DEFAULT 0');
        if (!txnCols.includes('created_at')) await db.query('ALTER TABLE transactions ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

        // --- Payments Migrations ---
        const payCols = await getColumns('payments');
        if (!payCols.includes('user_id')) await db.query('ALTER TABLE payments ADD COLUMN user_id UUID REFERENCES users(id)');
        if (!payCols.includes('package_id')) await db.query('ALTER TABLE payments ADD COLUMN package_id INTEGER REFERENCES coin_packages(id)');
        if (!payCols.includes('transaction_id')) await db.query('ALTER TABLE payments ADD COLUMN transaction_id VARCHAR(255) UNIQUE');
        if (!payCols.includes('amount')) await db.query('ALTER TABLE payments ADD COLUMN amount DECIMAL(10, 2) NOT NULL DEFAULT 0');
        if (!payCols.includes('status')) await db.query('ALTER TABLE payments ADD COLUMN status VARCHAR(50) DEFAULT \'completed\'');
        if (!payCols.includes('created_at')) await db.query('ALTER TABLE payments ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

        // --- OTPs Table & Migrations ---
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS otps (
                    id SERIAL PRIMARY KEY,
                    identifier VARCHAR(255) NOT NULL,
                    otp_code VARCHAR(10) NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await db.query('ALTER TABLE otps ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0');
        } catch (e) {
            console.error('[DB] Migration/Creation Error (otps):', e.message);
        }

        // Seed packages if none exist
        const result = await db.query('SELECT COUNT(*) FROM coin_packages');
        if (parseInt(result.rows[0].count) === 0) {
            console.log('[DB] Seeding default coin packages...');
            const packages = [
                { name: 'Başlangıç Paketi', price: 39.99, coins: 100, rc_id: 'coins_100' },
                { name: 'Gümüş Paket', price: 69.99, coins: 200, rc_id: 'coins_200' },
                { name: 'Altın Paket', price: 129.99, coins: 400, rc_id: 'coins_400' },
                { name: 'VIP Paket', price: 249.99, coins: 700, rc_id: 'coins_700' },
                { name: 'Platin Paket', price: 449.99, coins: 1200, rc_id: 'coins_1200' },
                { name: 'Efsane Paket', price: 949.99, coins: 2500, rc_id: 'coins_2500' },
                { name: 'Ultimate Paket', price: 1749.99, coins: 5000, rc_id: 'coins_5000' }
            ];

            for (const pkg of packages) {
                await db.query(
                    'INSERT INTO coin_packages (name, price, coins, revenuecat_id) VALUES ($1, $2, $3, $4)',
                    [pkg.name, pkg.price, pkg.coins, pkg.rc_id]
                );
            }
            console.log('[DB] Default coin packages seeded.');
        }

        // Check for users table columns
        const columns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
        const columnNames = columns.rows.map(c => c.column_name);

        if (!columnNames.includes('age')) {
            console.log('[DB] Adding missing column: age');
            await db.query('ALTER TABLE users ADD COLUMN age INTEGER DEFAULT 18');
        }

        if (!columnNames.includes('name')) {
            console.log('[DB] Adding missing column: name');
            await db.query('ALTER TABLE users ADD COLUMN name VARCHAR(255)');
        }

        if (!columnNames.includes('display_name')) {
            console.log('[DB] Adding missing column: display_name');
            await db.query('ALTER TABLE users ADD COLUMN display_name VARCHAR(255)');
        }

        if (!columnNames.includes('interests')) {
            console.log('[DB] Adding missing column: interests');
            await db.query('ALTER TABLE users ADD COLUMN interests TEXT');
        }

        if (!columnNames.includes('referral_code')) {
            console.log('[DB] Adding missing column: referral_code');
            await db.query('ALTER TABLE users ADD COLUMN referral_code VARCHAR(50) UNIQUE');
        }

        // FORCE TYPE CHANGE FOR referred_by TO AVOID UUID/INT CONFLICTS
        try {
            await db.query('ALTER TABLE users ALTER COLUMN referred_by TYPE TEXT');
            console.log('[DB] users.referred_by column altered to TEXT');
        } catch (e) { /* already text or other error */ }

        if (!columnNames.includes('relationship')) {
            console.log('[DB] Adding missing column: relationship');
            await db.query('ALTER TABLE users ADD COLUMN relationship VARCHAR(50)');
        }

        if (!columnNames.includes('zodiac')) {
            console.log('[DB] Adding missing column: zodiac');
            await db.query('ALTER TABLE users ADD COLUMN zodiac VARCHAR(50)');
        }

        // --- NEW MIGRATION: Make password_hash nullable for social login ---
        await db.query('ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL');


        if (!columnNames.includes('job')) {
            console.log('[DB] Adding missing column: job');
            await db.query('ALTER TABLE users ADD COLUMN job VARCHAR(100)');
        }

        if (!columnNames.includes('edu')) {
            console.log('[DB] Adding missing column: edu');
            await db.query('ALTER TABLE users ADD COLUMN edu VARCHAR(100)');
        }

        if (!columnNames.includes('bio')) {
            console.log('[DB] Adding missing column: bio');
            await db.query('ALTER TABLE users ADD COLUMN bio TEXT');
        }

        if (!columnNames.includes('boy')) {
            console.log('[DB] Adding missing column: boy');
            await db.query('ALTER TABLE users ADD COLUMN boy VARCHAR(20)');
        }

        if (!columnNames.includes('push_token')) {
            console.log('[DB] Adding missing column: push_token');
            await db.query('ALTER TABLE users ADD COLUMN push_token VARCHAR(255)');
        }

        if (!columnNames.includes('kilo')) {
            console.log('[DB] Adding missing column: kilo');
            await db.query('ALTER TABLE users ADD COLUMN kilo VARCHAR(20)');
        }

        if (!columnNames.includes('avatar_url')) {
            console.log('[DB] Adding missing column: avatar_url');
            await db.query('ALTER TABLE users ADD COLUMN avatar_url TEXT');
        }

        if (!columnNames.includes('gender')) {
            console.log('[DB] Adding missing column: gender');
            await db.query('ALTER TABLE users ADD COLUMN gender VARCHAR(50)');
        }

        if (!columnNames.includes('onboarding_completed')) {
            console.log('[DB] Adding missing column: onboarding_completed');
            await db.query('ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT false');
        }

        if (!columnNames.includes('last_auto_message_at')) {
            console.log('[DB] Adding missing column: last_auto_message_at');
            await db.query('ALTER TABLE users ADD COLUMN last_auto_message_at TIMESTAMP');
        }

        // Fix pending_photos schema if it exists with wrong ID type or missing default
        const photoCols = await db.query("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'pending_photos'");
        const photoColNames = photoCols.rows.map(c => c.column_name);
        if (photoColNames.length > 0) {
            const idCol = photoCols.rows.find(c => c.column_name === 'id');
            if (idCol && idCol.data_type === 'uuid' && !idCol.column_default) {
                console.log('[DB] Fixing pending_photos id default...');
                await db.query('ALTER TABLE pending_photos ALTER COLUMN id SET DEFAULT gen_random_uuid()');
            }
        }

        if (!columnNames.includes('vip_level')) {
            console.log('[DB] Adding missing column: vip_level');
            await db.query('ALTER TABLE users ADD COLUMN vip_level INTEGER DEFAULT 0');
        }

        if (!columnNames.includes('is_vip')) {
            console.log('[DB] Adding missing column: is_vip');
            await db.query('ALTER TABLE users ADD COLUMN is_vip BOOLEAN DEFAULT FALSE');
        }

        if (!columnNames.includes('photos')) {
            console.log('[DB] Adding missing column: photos');
            await db.query('ALTER TABLE users ADD COLUMN photos TEXT[] DEFAULT \'{}\'');
        }

        if (!columnNames.includes('is_verified')) {
            console.log('[DB] Adding missing column: is_verified');
            await db.query('ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE');
        }

        if (!columnNames.includes('phone')) {
            console.log('[DB] Adding missing column: phone');
            await db.query('ALTER TABLE users ADD COLUMN phone VARCHAR(20) UNIQUE');
        }

        if (!columnNames.includes('is_agency_owner')) {
            console.log('[DB] Adding missing column: is_agency_owner');
            await db.query('ALTER TABLE users ADD COLUMN is_agency_owner BOOLEAN DEFAULT FALSE');
        }

        if (!columnNames.includes('last_login_at')) {
            console.log('[DB] Adding missing column: last_login_at');
            await db.query('ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP');
        }


        if (!columnNames.includes('ban_expires_at')) {
            console.log('[DB] Adding missing column: ban_expires_at');
            await db.query('ALTER TABLE users ADD COLUMN ban_expires_at TIMESTAMP');
        }

        // --- RECOVERY FIX: Ensure all matching operator entries exist and are active ---
        console.log('[RECOVERY] Checking for missing operator profiles...');

        // 1. Force all staff roles to be active (to recover accidental soft-deletes/NULLs)
        await db.query(`
            UPDATE users 
            SET account_status = 'active' 
            WHERE role IN ('operator', 'moderator', 'admin', 'super_admin') 
            AND (account_status IS NULL OR account_status = 'deleted' OR account_status = 'under_review')
        `);

        // 2. Fix missing operators table entries
        const missingOps = await db.query(`
            SELECT id FROM users 
            WHERE role IN ('operator', 'moderator', 'admin', 'super_admin', 'staff')
            AND id NOT IN (SELECT user_id FROM operators)
        `);

        if (missingOps.rows.length > 0) {
            console.log(`[RECOVERY] Found ${missingOps.rows.length} users with operator role missing from operators table. Repairing...`);
            for (const user of missingOps.rows) {
                await db.query(
                    "INSERT INTO operators (user_id, category, bio, photos, is_online, rating) VALUES ($1, 'Genel', 'Merhaba!', '{}', false, 5.0)",
                    [user.id]
                );
            }
            console.log('[RECOVERY] Repair complete.');
        } else {
            console.log('[RECOVERY] No synchronization issues found.');
        }

        // Detect users.id type to ensure FK compatibility
        let userIdType = 'UUID';
        const userTypeCheck = await db.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id'");
        if (userTypeCheck.rows.length > 0) {
            userIdType = userTypeCheck.rows[0].data_type.toUpperCase() === 'INTEGER' ? 'INTEGER' : 'UUID';
            console.log(`[DB] Detected users.id type: ${userIdType}`);
        }
        app.set('user_id_type', userIdType);

        // Fix activities table user_id type if mismatched
        const actCols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'activities'");
        const actColNames = actCols.rows.map(c => c.column_name);

        if (actColNames.length > 0) {
            const userIdCol = actCols.rows.find(c => c.column_name === 'user_id');
            if (userIdCol && userIdCol.data_type.toUpperCase() !== userIdType) {
                console.log(`[DB] Syncing activities.user_id type to ${userIdType}...`);
                await db.query(`ALTER TABLE activities ALTER COLUMN user_id TYPE ${userIdType} USING user_id::${userIdType}`);
            }
        } else {
            await db.query(`CREATE TABLE IF NOT EXISTS activities (
                id SERIAL PRIMARY KEY,
                user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
                action_type VARCHAR(50),
                description TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )`);
        }

        // Fix posts table operator_id type if mismatched
        const postColsCheck = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'posts'");
        const postColNames = postColsCheck.rows.map(c => c.column_name);
        if (postColNames.length > 0) {
            const opIdCol = postColsCheck.rows.find(c => c.column_name === 'operator_id');
            if (opIdCol && opIdCol.data_type.toUpperCase() !== userIdType) {
                console.log(`[DB] Syncing posts.operator_id type to ${userIdType}...`);
                await db.query(`ALTER TABLE posts ALTER COLUMN operator_id TYPE ${userIdType} USING operator_id::TEXT::${userIdType}`);
            }
        }

        // Fix stories table operator_id type if mismatched
        const storyColsCheck = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'stories'");
        const storyColNames = storyColsCheck.rows.map(c => c.column_name);
        if (storyColNames.length > 0) {
            const opIdCol = storyColsCheck.rows.find(c => c.column_name === 'operator_id');
            if (opIdCol && opIdCol.data_type.toUpperCase() !== userIdType) {
                console.log(`[DB] Syncing stories.operator_id type to ${userIdType}...`);
                await db.query(`ALTER TABLE stories ALTER COLUMN operator_id TYPE ${userIdType} USING operator_id::TEXT::${userIdType}`);
            }
        }

        // Fix story_likes table types
        const storyLikeColsCheck = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'story_likes'");
        if (storyLikeColsCheck.rows.length > 0) {
            const userIdCol = storyLikeColsCheck.rows.find(c => c.column_name === 'user_id');
            if (userIdCol && userIdCol.data_type.toUpperCase() !== userIdType) {
                console.log(`[DB] Syncing story_likes.user_id type to ${userIdType}...`);
                await db.query(`ALTER TABLE story_likes ALTER COLUMN user_id TYPE ${userIdType} USING user_id::TEXT::${userIdType}`);
            }
        }

        // Fix post_comments table types
        const commentColsCheck = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'post_comments'");
        if (commentColsCheck.rows.length > 0) {
            const userIdCol = commentColsCheck.rows.find(c => c.column_name === 'user_id');
            if (userIdCol && userIdCol.data_type.toUpperCase() !== userIdType) {
                console.log(`[DB] Syncing post_comments.user_id type to ${userIdType}...`);
                await db.query(`ALTER TABLE post_comments ALTER COLUMN user_id TYPE ${userIdType} USING user_id::TEXT::${userIdType}`);
            }
        }

        // Migration logic
        // Messages table enhancements
        await db.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS gift_id INT');
        await db.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS unlock_cost INTEGER DEFAULT 0');
        await db.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_unlocked BOOLEAN DEFAULT false');
        await db.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_replied BOOLEAN DEFAULT false');
        await db.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS earned_diamonds NUMERIC DEFAULT 0');

        // Users & Chats table enhancements
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS device_id VARCHAR(255)');
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_id TEXT');
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_by UUID REFERENCES users(id) ON DELETE SET NULL');
        await db.query('ALTER TABLE chats ADD COLUMN IF NOT EXISTS last_message TEXT');
        await db.query('ALTER TABLE payments ADD COLUMN IF NOT EXISTS coin_amount INTEGER');

        // Operators table enhancements
        await db.query('ALTER TABLE operators ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP');
        await db.query('ALTER TABLE operators ADD COLUMN IF NOT EXISTS pending_balance INT DEFAULT 0');
        await db.query('ALTER TABLE operators ADD COLUMN IF NOT EXISTS lifetime_earnings INT DEFAULT 0');
        await db.query('ALTER TABLE operators ADD COLUMN IF NOT EXISTS last_payout_at TIMESTAMP');

        // Create tables one by one to avoid one failure blocking all migrations
        const runMigration = async (name, sql) => {
            try {
                await db.query(sql);
            } catch (err) {
                console.error(`[DB] Migration Error (${name}):`, err.message);
                app.set('db_status', (app.get('db_status') || 'ready') + ` | Error ${name}: ${err.message}`);
            }
        };

        await runMigration('Extensions', 'CREATE EXTENSION IF NOT EXISTS pgcrypto');

        await runMigration('PostsTable', `CREATE TABLE IF NOT EXISTS posts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            operator_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
            image_url TEXT NOT NULL,
            content TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        await runMigration('StoriesTable', `CREATE TABLE IF NOT EXISTS stories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            operator_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
            image_url TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
        )`);

        await runMigration('PostLikesTable', `CREATE TABLE IF NOT EXISTS post_likes (
            post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
            user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            PRIMARY KEY (post_id, user_id)
        )`);

        await runMigration('StoryLikesTable', `CREATE TABLE IF NOT EXISTS story_likes (
            story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
            user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            PRIMARY KEY (story_id, user_id)
        )`);

        await runMigration('PostCommentsTable', `CREATE TABLE IF NOT EXISTS post_comments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
            user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        await runMigration('BoostsTable', `CREATE TABLE IF NOT EXISTS boosts (
            id SERIAL PRIMARY KEY,
            user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
            start_time TIMESTAMP DEFAULT NOW(),
            end_time TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        // --- ADDED: Operator Stats Table (Core Startup Migration) ---
        await runMigration("Create Operator Stats Table", `
            CREATE TABLE IF NOT EXISTS operator_stats (
                id SERIAL PRIMARY KEY,
                operator_id ${userIdType},
                date DATE DEFAULT CURRENT_DATE,
                messages_sent INTEGER DEFAULT 0,
                coins_earned NUMERIC DEFAULT 0,
                UNIQUE(operator_id, date)
            )
        `);

        await runMigration("Add granular stats columns", `
            ALTER TABLE operator_stats 
            ADD COLUMN IF NOT EXISTS text_count INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS image_count INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS audio_count INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS gift_count INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS text_earned NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS image_earned NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS audio_earned NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS gift_earned NUMERIC DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_user_spend NUMERIC DEFAULT 0
        `);

        await runMigration("Ensure coins_earned is NUMERIC", 'ALTER TABLE operator_stats ALTER COLUMN coins_earned TYPE NUMERIC');

        await runMigration('FavoritesTable', `CREATE TABLE IF NOT EXISTS favorites (
            id SERIAL PRIMARY KEY,
            user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
            target_user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE (user_id, target_user_id)
        )`);

        await runMigration('ProfileViewsTable', `CREATE TABLE IF NOT EXISTS profile_views (
            id SERIAL PRIMARY KEY,
            viewer_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
            viewed_user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        await runMigration('PaymentsTable', `CREATE TABLE IF NOT EXISTS payments (
            id SERIAL PRIMARY KEY,
            user_id ${userIdType} REFERENCES users(id),
            package_id INTEGER REFERENCES coin_packages(id),
            transaction_id VARCHAR(255),
            amount DECIMAL(10, 2) NOT NULL,
            coin_amount INTEGER
        )`);

        // CRITICAL FIX: Remove faulty 'kadin' default for gender column
        await db.query(`ALTER TABLE users ALTER COLUMN gender DROP DEFAULT`);
        await db.query(`ALTER TABLE users ALTER COLUMN gender SET DEFAULT 'not_set'`);
        console.log('[DB] Fixed gender column default value');

        await runMigration('AdminNotificationsTable', `CREATE TABLE IF NOT EXISTS admin_notifications (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            target_group VARCHAR(50),
            sent_count INTEGER DEFAULT 0,
            sent_at TIMESTAMP DEFAULT NOW()
        )`);

        await runMigration('CampaignsTable', `CREATE TABLE IF NOT EXISTS campaigns (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            bonus_percent INTEGER DEFAULT 0,
            start_date TIMESTAMP NOT NULL,
            end_date TIMESTAMP NOT NULL,
            target VARCHAR(50) DEFAULT 'all',
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        await runMigration('MessageSchedulesTable', `CREATE TABLE IF NOT EXISTS message_schedules (
            id SERIAL PRIMARY KEY,
            operator_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
            target VARCHAR(50) DEFAULT 'random',
            target_user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
            message_template TEXT NOT NULL,
            send_at_hour INTEGER NOT NULL,
            send_at_minute INTEGER NOT NULL,
            days_of_week INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        await runMigration('QuickRepliesTable', `CREATE TABLE IF NOT EXISTS quick_replies (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        await runMigration('ReportsTable', `CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            reported_id ${userIdType} REFERENCES users(id) ON DELETE SET NULL,
            reporter_id ${userIdType} REFERENCES users(id) ON DELETE SET NULL,
            reason TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        // --- 5. High-Performance DB Indices ---
        console.log('[DB] Ensuring database indexes exist for performance...');
        await runMigration('idx_messages_chat_id', 'CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)');
        await runMigration('idx_messages_sender_id', 'CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)');
        await runMigration('idx_chats_user_id', 'CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id)');
        await runMigration('idx_chats_operator_id', 'CREATE INDEX IF NOT EXISTS idx_chats_operator_id ON chats(operator_id)');
        await runMigration('idx_messages_chat_unread', 'CREATE INDEX IF NOT EXISTS idx_messages_chat_unread ON messages(chat_id, sender_id) WHERE is_read = false');
        await runMigration('idx_users_agency_id', 'CREATE INDEX IF NOT EXISTS idx_users_agency_id ON users(agency_id)');
        await runMigration('idx_commission_logs_agency_id', 'CREATE INDEX IF NOT EXISTS idx_commission_logs_agency_id ON commission_logs(agency_id)');
        await runMigration('idx_commission_logs_operator_id', 'CREATE INDEX IF NOT EXISTS idx_commission_logs_operator_id ON commission_logs(operator_id)');

        // One-time production correction for affected virtual operators and user "Aysel demir" back to 'kadin'
        await db.query("UPDATE users SET gender = 'kadin' WHERE (id::text IN ('41', '44', '51') OR display_name ILIKE '%Aysel%' OR username ILIKE '%Aysel%') AND gender != 'kadin'");
        console.log('[DB] Production operators and Aysel gender correction verified');

        console.log('[DB] SCHEMA VERIFICATION COMPLETE');
        if (!app.get('db_status')) app.set('db_status', 'ready');
    } catch (err) {
        console.error('[DB] CRITICAL SCHEMA ERROR:', err.message);
        app.set('db_status', 'error: ' + err.message);
    }
};

module.exports = { initializeDatabase };
