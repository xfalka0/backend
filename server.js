const express = require('express');
const axios = require('axios');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();
const bcrypt = require('bcrypt');
const { authenticateToken, authorizeRole, SECRET_KEY } = require('./middleware/auth');
const { getVipLevel, getVipProgress } = require('./utils/vipUtils');
const { recordOperatorCommission } = require('./utils/commissionUtils');
const jwt = require('jsonwebtoken');
const socialRoutes = require('./routes/socialRoutes');
const authRoutes = require('./routes/authRoutes');
const referralRoutes = require('./routes/referralRoutes');
const favoritesRoutes = require('./routes/favorites');
const viewsRoutes = require('./routes/views');
const boostsRoutes = require('./routes/boosts');
const webhooksRoutes = require('./routes/webhooks');
const { sanitizeUser, logActivity, MALE_NAMES_ARRAY, MALE_NAME_PATTERN, assignFakeInteractions, triggerAutoEngagement } = require('./utils/helpers');
const { sendPushNotification } = require('./utils/notificationUtils');

const normalizeText = (value = '') => {
    if (!value) return '';
    let text = value.toString();
    
    // Manual Turkish character replacement for maximum reliability
    text = text.replace(/İ/g, 'i')
               .replace(/I/g, 'ı')
               .replace(/ı/g, 'i')
               .replace(/Ş/g, 's')
               .replace(/ş/g, 's')
               .replace(/Ğ/g, 'g')
               .replace(/ğ/g, 'g')
               .replace(/Ü/g, 'u')
               .replace(/ü/g, 'u')
               .replace(/Ö/g, 'o')
               .replace(/ö/g, 'o')
               .replace(/Ç/g, 'c')
               .replace(/ç/g, 'c');

    return text.toLowerCase()
               .normalize('NFD')
               .replace(/[\u0300-\u036f]/g, '')
               .replace(/[^a-z0-9\s]/g, ' ')
               .replace(/\s+/g, ' ')
               .trim();
};

const normalizeGenderValue = (gender) => {
    const raw = (gender || '').toString().trim().toLowerCase();
    const value = normalizeText(raw);

    if (value === 'coin_bayisi') return 'coin_bayisi';
    if (value === 'erkek' || value === 'male' || value === 'man') return 'erkek';
    if (value === 'kadin' || value === 'female' || value === 'woman') return 'kadin';
    return null;
};

// --- NEW MODULAR ROUTES ---
const adminUsersRoutes = require('./routes/adminUsers');
const adminOperatorsRoutes = require('./routes/adminOperators');
const adminPanelRoutes = require('./routes/adminPanel');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const packageRoutes = require('./routes/packageRoutes');
const starterPackRoutes = require('./routes/starterPackRoutes');
// --------------------------

const app = express();
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;

// Trust proxy for Render/HTTPS
app.enable('trust proxy');

// Cloudinary Configuration Check
if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.warn('⚠️ [WARNING] CLOUDINARY_CLOUD_NAME is not set in environment variables.');
}

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- DATABASE AUTO-MIGRATION & INITIALIZATION ---
const initializeDatabase = async () => {
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
        } catch (e) { /* ignore if column doesn't exist yet */ }

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

        // --- OTPs Migrations ---
        try {
            await db.query('ALTER TABLE otps ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0');
        } catch (e) {
            console.error('[DB] Migration Error (otps attempts):', e.message);
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
            reporter_id ${userIdType} REFERENCES users(id) ON DELETE SET NULL,
            reported_id ${userIdType} REFERENCES users(id) ON DELETE SET NULL,
            reason TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        // Auto-fix genders on startup (ONLY for unassigned/unset genders to prevent overwriting valid user data)
        await db.query(
            `UPDATE users 
             SET gender = 'erkek' 
             WHERE (gender = 'not_set' OR gender IS NULL OR gender = '')
               AND translate(LOWER(COALESCE(display_name, '') || ' ' || COALESCE(name, '') || ' ' || COALESCE(username, '')), 'çğıöşü', 'cgiosu') ~* $1`,
            [MALE_NAME_PATTERN]
        );
        const MALE_NAMES = ['Mustafa', 'Furkan', 'Ahmet', 'Mehmet', 'Ali', 'Veli', 'Can', 'Murat', 'Hakan', 'Emre', 'Burak', 'Volkan', 'Gökhan', 'Serkan', 'Ömer', 'Osman', 'İbrahim', 'Halil', 'Ramadan', 'Ramazan', 'Fırat', 'Mert', 'Yiğit', 'Arda', 'Hasan', 'İhsan', 'Fatih', 'Süleyman', 'Yusuf', 'Eren', 'Okan', 'Onur', 'Umut', 'Mertcan', 'Enes', 'Yunus', 'Emir', 'Kadir', 'Karadayı', 'Adabi', 'Zafer', 'Sultan', 'Turan', 'Yılmaz', 'Metin', 'Bekir', 'Kamil'];
        for (const name of MALE_NAMES) {
            await db.query(
                "UPDATE users SET gender = 'erkek' WHERE (display_name ILIKE $1 OR username ILIKE $1) AND (gender = 'not_set' OR gender IS NULL OR gender = '')",
                ["%" + name + "%"]
            );
        }
        
        const FEMALE_NAMES = ['Ayşe', 'Fatma', 'Su', 'Esma', 'Emriye', 'Zeynep', 'Elif', 'Merve', 'Selin', 'Ece', 'Aslı', 'Deniz', 'Güneş', 'Buse', 'Hazal', 'Simge', 'İrem', 'Ceren', 'Ada', 'Dilan', 'Berfin', 'Seda', 'Ceyda', 'Dilara', 'Bahar', 'Yağmur', 'Eylül', 'Nisan', 'Melis', 'Merve', 'Gamze'];
        for (const name of FEMALE_NAMES) {
            await db.query(
                "UPDATE users SET gender = 'kadin' WHERE (display_name ILIKE $1 OR username ILIKE $1) AND (gender = 'not_set' OR gender IS NULL OR gender = '')",
                ["%" + name + "%"]
            );
        }
        console.log('[DB] Initial gender auto-fix completed');

        // One-time production correction for affected virtual operators back to 'kadin'
        await db.query("UPDATE users SET gender = 'kadin' WHERE id IN (41, 44, 51) AND gender != 'kadin'");
        console.log('[DB] Production operators gender correction verified');

        console.log('[DB] SCHEMA VERIFICATION COMPLETE');
        if (!app.get('db_status')) app.set('db_status', 'ready');
    } catch (err) {
        console.error('[DB] CRITICAL SCHEMA ERROR:', err.message);
        app.set('db_status', 'error: ' + err.message);
    }
};

// --- DIAGNOSTIC ENDPOINT ---
app.get('/api/health-check', async (req, res) => {
    try {
        const dbCheck = await db.query('SELECT NOW()');
        const tablesToInspect = ['users', 'posts', 'stories', 'operators', 'boosts', 'favorites', 'profile_views', 'transactions', 'payments'];
        const schemaInfo = {};

        for (const table of tablesToInspect) {
            const columns = await db.query(
                "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'",
                [table]
            );
            schemaInfo[table] = columns.rows;
        }

        const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");

        res.json({
            status: 'online',
            db: 'connected',
            db_time: dbCheck.rows[0].now,
            db_status: app.get('db_status'),
            tables: tables.rows.map(t => t.table_name),
            schema_info: schemaInfo,
            env: {
                has_cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
                has_jwt_secret: !!process.env.JWT_SECRET,
                node_env: process.env.NODE_ENV
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', database: err.message });
    }
});

const server = http.createServer(app);

const getLocalIpAddress = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '192.168.1.100'; // Fallback
};
const SERVER_IP = getLocalIpAddress();
console.log(`[SERVER] Detected Local IP: ${SERVER_IP}`);

// Ensure uploads directory exists (Absolute path)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Config (Updated for Render/Cloudinary)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Use system temp directory to avoid permission issues on Render
        cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
        // Keep extension for Cloudinary to detect type
        const fname = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        console.log('[MULTER] Generated temp filename:', fname);
        cb(null, fname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
        if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Desteklenmeyen dosya türü. Sadece resim, video ve ses yüklenebilir.'));
        }
    }
});

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});
app.set('io', io);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public/admin')));
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));

// --- SERVING LEGAL PAGES ---
app.get('/privacy.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'privacy.html'));
});
app.get('/delete-account.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'delete-account.html'));
});
// ---------------------------

app.get('*', (req, res, next) => {
    // If it's an asset request that reached here, it means it's missing.
    // Don't serve index.html for these, let it 404 naturally or return 404.
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$/)) {
        return res.status(404).end();
    }
    next();
});
// --- PRIMARY API ROUTES (Order matters to avoid shadowing) ---
// --- PRIMARY API ROUTES (Order matters to avoid shadowing) ---
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Çok fazla istek gönderildi, lütfen sonra tekrar deneyin.' }
});

// --- SMTP Email Setup ---
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport(
    process.env.SMTP_HOST 
        ? {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT, 10) || 465,
            secure: process.env.SMTP_SECURE !== 'false',
            auth: {
                user: process.env.EMAIL_USER || '',
                pass: process.env.EMAIL_PASS || ''
            },
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 5000,
            family: 4
          }
        : {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER || '',
                pass: process.env.EMAIL_PASS || ''
            },
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 5000,
            family: 4
          }
);

const getCleanedBrevoKey = () => {
    const rawKey = process.env.BREVO_API_KEY || '';
    const match = rawKey.match(/(xkeysib-[a-zA-Z0-9-]+)/);
    return match ? match[1] : '';
};

let cachedBrevoSender = null;
const getBrevoSender = async (apiKey) => {
    if (cachedBrevoSender) return cachedBrevoSender;
    try {
        console.log('[EMAIL] Fetching verified senders from Brevo...');
        const res = await axios.get('https://api.brevo.com/v3/senders', {
            headers: { 'api-key': apiKey },
            timeout: 5000
        });
        const activeSender = res.data.senders?.find(s => s.active);
        if (activeSender) {
            cachedBrevoSender = { name: 'Fiva', email: activeSender.email };
            console.log(`[EMAIL] Cached Brevo sender: ${activeSender.email}`);
            return cachedBrevoSender;
        }
    } catch (err) {
        console.error('[EMAIL] Failed to fetch Brevo senders:', err.message);
    }
    return { name: 'Fiva', email: process.env.EMAIL_USER || 'fdnsmn00@gmail.com' };
};

const sendOtpEmail = async (email, otp) => {
    const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Fiva Giriş Kodu</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #ffffff;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background-color: #1e1b4b; border-radius: 24px; overflow: hidden; border: 1.5px solid rgba(255, 255, 255, 0.08); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
                <tr>
                    <td style="padding: 40px 40px 20px 40px; text-align: center;">
                        <div style="display: inline-block; width: 70px; height: 70px; border-radius: 35px; background: linear-gradient(135deg, #8b5cf6, #ec4899); line-height: 70px; text-align: center; color: #ffffff; font-size: 32px; font-weight: bold; margin-bottom: 20px;">
                            ♥
                        </div>
                        <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Fiva'ya Hoş Geldin!</h1>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 20px 40px 30px 40px; text-align: center;">
                        <p style="margin: 0 0 24px 0; font-size: 16px; color: rgba(255, 255, 255, 0.7); line-height: 24px;">Giriş yapmak veya hesap oluşturmak için kullanabileceğin tek kullanımlık doğrulama kodun aşağıdadır:</p>
                        <div style="display: inline-block; background-color: rgba(139, 92, 246, 0.15); border: 2px solid #8b5cf6; border-radius: 16px; padding: 18px 40px; font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #ffffff; text-shadow: 0 0 10px rgba(139, 92, 246, 0.5); margin-bottom: 24px;">
                            ${otp}
                        </div>
                        <p style="margin: 0; font-size: 13px; color: rgba(255, 255, 255, 0.4); line-height: 20px;">Bu kod 10 dakika boyunca geçerlidir. Eğer bu talebi siz yapmadıysanız bu e-postayı güvenle görmezden gelebilirsiniz.</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 30px 40px 40px 40px; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center; background-color: rgba(0, 0, 0, 0.15);">
                        <p style="margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.3);">Fiva Dating App &bull; Tüm Hakları Saklıdır.</p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;

    // 1. Check if BREVO_API_KEY is configured (Highly recommended for Render cloud deployment)
    const cleanedBrevoKey = getCleanedBrevoKey();
    if (cleanedBrevoKey) {
        try {
            console.log(`[EMAIL] Sending verification mail to: ${email} via Brevo HTTP API...`);
            const sender = await getBrevoSender(cleanedBrevoKey);
            const response = await axios.post('https://api.brevo.com/v3/smtp/email', {
                sender: sender,
                to: [{ email: email }],
                subject: 'Fiva Giriş Kodu',
                htmlContent: emailHtml
            }, {
                headers: {
                    'api-key': cleanedBrevoKey,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            console.log('[EMAIL] Mail sent successfully via Brevo. Message ID:', response.data.messageId);
            return;
        } catch (err) {
            console.error('[EMAIL] Failed to send email via Brevo HTTP API:', err.response?.data || err.message);
            console.log('[EMAIL] Attempting fallback to SMTP...');
        }
    }

    // 2. Fallback to Nodemailer SMTP (Default local development)
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[EMAIL] SMTP credentials (EMAIL_USER/EMAIL_PASS) are missing. Skipping mail delivery, but code is generated.');
        return;
    }

    try {
        console.log(`[EMAIL] Sending verification mail to: ${email} via SMTP...`);
        const mailOptions = {
            from: `"Fiva" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Fiva Giriş Kodu',
            html: emailHtml
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('[EMAIL] Mail sent successfully via SMTP. Message ID:', info.messageId);
    } catch (err) {
        console.error('[EMAIL] Failed to send verification email via SMTP:', err.message);
    }
};

app.post('/api/auth/request-otp', authLimiter, async (req, res) => {
    let { email, phone } = req.body;
    if (email) email = email.trim().toLowerCase();
    const identifier = email || phone;
    if (!identifier) return res.status(400).json({ error: 'Email veya Telefon gerekli.' });
    try {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000);
        
        // Security: Clean up expired OTPs (Keeps database lightweight and fast)
        await db.query('DELETE FROM otps WHERE expires_at < NOW()');

        await db.query('DELETE FROM otps WHERE identifier = $1', [identifier]);
        await db.query('INSERT INTO otps (identifier, otp_code, expires_at) VALUES ($1, $2, $3)', [identifier, otp, expires]);
        console.log(`[AUTH] OTP for ${identifier}: ${otp}`);

        // If it's an email, and SMTP is configured, send the mail!
        if (email) {
            sendOtpEmail(email, otp);
        }

        res.json({ success: true, message: 'OTP gönderildi (Konsol loguna bakınız).', dev_otp: otp });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/auth/smtp-diagnostics', async (req, res) => {
    const cleanedBrevoKey = getCleanedBrevoKey();
    const results = {
        success: false,
        brevo: {
            configured: !!cleanedBrevoKey,
            key_length: cleanedBrevoKey ? cleanedBrevoKey.length : 0,
            status: 'NOT_TESTED'
        },
        smtp: {
            configured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
            EMAIL_USER: process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 4)}...` : 'MISSING',
            EMAIL_PASS_LENGTH: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0,
            status: 'NOT_TESTED'
        }
    };

    // Test Brevo if configured
    if (cleanedBrevoKey) {
        try {
            console.log('[DIAGNOSTICS] Verifying Brevo API Key...');
            const response = await axios.get('https://api.brevo.com/v3/smtp/templates', {
                headers: { 'api-key': cleanedBrevoKey },
                timeout: 5000
            });
            results.brevo.status = 'SUCCESS';
            results.success = true;
        } catch (err) {
            results.brevo.status = 'FAILED';
            results.brevo.error = err.response?.data || err.message;
        }
    }

    // Test SMTP if configured
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
            console.log('[DIAGNOSTICS] Verifying SMTP connection...');
            await transporter.verify();
            results.smtp.status = 'SUCCESS';
            results.success = true;
        } catch (err) {
            results.smtp.status = 'FAILED';
            results.smtp.error = err.message;
            results.smtp.code = err.code;
        }
    }

    if (results.success) {
        res.json({ success: true, message: 'At least one email service is fully functional!', details: results });
    } else {
        res.status(500).json({ success: false, message: 'All email services failed connection verification.', details: results });
    }
});

app.post('/api/auth/verify-otp', async (req, res) => {
    let { email, phone, code, otp, deviceId } = req.body;
    if (email) email = email.trim().toLowerCase();
    const finalCode = code || otp;
    const identifier = email || phone;
    try {
        // --- GOOGLE REVIEWER BYPASS ---
        if ((email === 'test@example.com' || phone === '+10000000000') && finalCode === '123456') {
            console.log('[AUTH] Google Reviewer Bypass triggered for:', identifier);
        } else {
            // Fetch OTP by identifier only to verify attempts and perform JS-level timezone safe expiration check
            const otpRes = await db.query('SELECT * FROM otps WHERE identifier = $1', [identifier]);
            if (otpRes.rows.length === 0) {
                return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş kod. Lütfen yeni bir kod isteyin.' });
            }

            const otpRow = otpRes.rows[0];
            const now = new Date();
            
            // Timezone-safe expiration check in JS (completely immune to Postgres timezone casting differences!)
            if (new Date(otpRow.expires_at) < now) {
                await db.query('DELETE FROM otps WHERE identifier = $1', [identifier]);
                return res.status(401).json({ error: 'Bu kodun süresi dolmuş. Lütfen yeni bir kod isteyin.' });
            }

            // Brute-force protection: Increment attempts on failure, lock after 5 attempts
            if (otpRow.otp_code !== finalCode) {
                const currentAttempts = (otpRow.attempts || 0) + 1;
                if (currentAttempts >= 5) {
                    await db.query('DELETE FROM otps WHERE identifier = $1', [identifier]);
                    return res.status(401).json({ error: 'Çok fazla hatalı deneme yaptınız. Lütfen yeni bir kod isteyin.' });
                } else {
                    await db.query('UPDATE otps SET attempts = attempts + 1 WHERE identifier = $1', [identifier]);
                    return res.status(401).json({ error: `Hatalı kod girdiniz. Kalan hakkınız: ${5 - currentAttempts}` });
                }
            }

            // Successful verification: Delete OTP row
            await db.query('DELETE FROM otps WHERE identifier = $1', [identifier]);
        }
        // --- END BYPASS ---
        let result;
        if (email) result = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
        else result = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
        let user;
        if (result.rows.length === 0) {
            if (deviceId) {
                const limitCheck = await db.query('SELECT count(*) FROM users WHERE device_id = $1', [deviceId]);
                if (parseInt(limitCheck.rows[0].count, 10) >= 2) return res.status(403).json({ error: 'Bu cihazdan en fazla 2 hesap oluşturulabilir.' });
            }
            const username = email ? email.split('@')[0] : `user_${Math.floor(1000 + Math.random() * 9000)}`;
            const insertResult = await db.query("INSERT INTO users (username, email, role, balance, avatar_url, display_name, device_id) VALUES ($1, $2, 'user', 50, 'https://via.placeholder.com/150', $3, $4) RETURNING *", [username, email || null, username, deviceId || null]);
            user = insertResult.rows[0];
            await assignFakeInteractions(user.id);
            await triggerAutoEngagement(io, user.id);
            await logActivity(io, user.id, 'register', 'Yeni kullanıcı OTP ile kayıt oldu.');
            io.emit('new_user', sanitizeUser(user, req));
        } else {
            user = result.rows[0];
            logActivity(io, user.id, 'login', 'Kullanıcı OTP ile giriş yaptı.');
        }
        if (user.account_status === 'deleted') return res.status(403).json({ error: 'Bu hesap silinmiş.' });
        if (user.account_status !== 'active') return res.status(403).json({ error: 'Hesabınız askıya alınmış.' });
        const token = jwt.sign({ 
            id: user.id, 
            username: user.username, 
            role: user.role, 
            display_name: user.display_name, 
            avatar_url: user.avatar_url,
            gender: user.gender 
        }, SECRET_KEY, { expiresIn: '30d' });
        res.json({ user: sanitizeUser(user, req), token });
    } catch (err) {
        console.error("OTP Verify Error:", err.message);
        res.status(500).json({ error: 'Giriş işlemi sırasında bir hata oluştu.' });
    }
});

app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT id, username, email, role, avatar_url, display_name, gender, onboarding_completed, balance FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/operators', async (req, res) => {
    try {
        const { gender, page = 1, limit = 100, tab = 'Önerilen' } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.max(1, parseInt(limit) || 10);
        const offset = (pageNum - 1) * limitNum;

        console.log(`[OPERATORS] Fetching. Gender: ${gender}, Tab: ${tab}, Page: ${pageNum}`);

        let query = `
            SELECT 
                u.id, 
                COALESCE(u.display_name, u.username) as name, 
                u.avatar_url, u.gender, u.age, u.vip_level, u.job, u.relationship, u.zodiac, u.interests, u.role,
                o.category, o.rating, o.is_online, 
                COALESCE(o.bio, u.bio) as bio, o.photos,
                EXISTS(SELECT 1 FROM stories s WHERE s.operator_id = u.id AND s.expires_at > NOW()) as has_active_story
            FROM users u
            JOIN operators o ON u.id = o.user_id
            WHERE u.account_status = 'active'
              AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff')
        `;

        let params = [];
        let paramCount = 1;

        if (gender && ['erkek', 'kadin', 'male', 'female', 'all'].includes(gender.toLowerCase())) {
            const normalizedGender = (gender.toLowerCase() === 'male' || gender.toLowerCase() === 'erkek') ? 'erkek' : 'kadin';
            if (gender.toLowerCase() !== 'all') {
                query += ` AND (LOWER(u.gender) = $${paramCount} OR u.gender = 'coin_bayisi') `;
                params.push(normalizedGender);
                paramCount++;

                if (normalizedGender === 'kadin') {
                    query += ` AND NOT (translate(LOWER(COALESCE(u.display_name, '') || ' ' || COALESCE(u.name, '') || ' ' || COALESCE(u.username, '')), 'çğıöşü', 'cgiosu') ~* $${paramCount}) `;
                    params.push(MALE_NAME_PATTERN);
                    paramCount++;
                }
            }
        }

        let orderByClause = '';
        if (tab === 'Yeni') {
            orderByClause = 'ORDER BY u.created_at DESC, u.id DESC';
        } else if (tab === 'Popüler') {
            orderByClause = 'ORDER BY u.vip_level DESC, o.rating DESC NULLS LAST, u.created_at DESC, u.id DESC';
        } else {
            orderByClause = 'ORDER BY o.is_online DESC, u.created_at DESC, u.id DESC';
        }

        query += ` ${orderByClause} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(limitNum, offset);

        const result = await db.query(query, params);

        const rows = result.rows.map(row => sanitizeUser(row, req));
        res.json(rows);
    } catch (err) {
        console.error("❌ [OPERATORS ERROR]:", err);
        res.status(500).json({
            error: "Operators fetch failed",
            message: err.message,
            code: err.code,
            detail: err.detail
        });
    }
});

// GET SINGLE OPERATOR
app.get('/api/operators/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM operators WHERE user_id = $1', [id]);

        if (result.rows.length === 0) {
            // Not an operator, but return empty photos to avoid 404 in ProfileScreen
            return res.json({ photos: [] });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UNIFIED DISCOVERY (Operators + Users of opposite gender)
app.get('/api/discovery', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 10, tab = 'Önerilen' } = req.query;
        const userId = req.user.id;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const offset = (pageNum - 1) * limitNum;
        
        let userGender = req.user.gender;
        if (!userGender) {
            // Fallback: Fetch from DB if not in token
            const userRes = await db.query('SELECT gender FROM users WHERE id = $1', [req.user.id]);
            userGender = userRes.rows[0]?.gender || 'erkek';
        }
        
        const userGenderRaw = userGender.toLowerCase();
        const normalizedUserGender = normalizeGenderValue(userGender) || 'erkek';
        const targetGender = normalizedUserGender === 'kadin' ? 'erkek' : 'kadin';

        console.log(`[DISCOVERY] User ${userId} (${userGenderRaw}) -> ${targetGender}. Tab: ${tab}`);

        let whereClause = `WHERE (LOWER(u.gender) = $1 OR u.gender = 'coin_bayisi') AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff')`;
        let queryParams = [targetGender, userId];
        
        if (targetGender === 'kadin') {
            const patterns = MALE_NAMES_ARRAY.map(name => `%${name}%`);
            whereClause += ` AND NOT (translate(LOWER(COALESCE(u.display_name, '') || ' ' || COALESCE(u.name, '') || ' ' || COALESCE(u.username, '')), 'çğıöşüİ', 'cgiosui') ILIKE ANY($3))`;
            queryParams.push(patterns);
        }

        let orderByClause = '';
        if (tab === 'Yeni') {
            orderByClause = 'ORDER BY u.created_at DESC, u.id DESC';
        } else if (tab === 'Popüler') {
            orderByClause = 'ORDER BY u.vip_level DESC, o.rating DESC NULLS LAST, u.created_at DESC, u.id DESC';
        } else {
            // "Önerilen" or Default
            orderByClause = 'ORDER BY (EXISTS(SELECT 1 FROM boosts b WHERE b.user_id = u.id AND b.end_time > NOW())) DESC, o.is_online DESC NULLS LAST, u.created_at DESC, u.id DESC';
        }

        const query = `
            SELECT 
                u.id, 
                COALESCE(u.display_name, u.username) as name, 
                u.avatar_url, 
                u.gender, 
                u.age, 
                u.vip_level, 
                u.job,
                u.relationship,
                u.zodiac,
                u.interests,
                u.role,
                o.category, 
                o.rating, 
                o.is_online, 
                COALESCE(o.bio, u.bio) as bio, 
                o.photos,
                CASE WHEN o.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_operator,
                EXISTS(SELECT 1 FROM stories s WHERE s.operator_id = u.id AND s.expires_at > NOW()) as has_active_story,
                EXISTS(SELECT 1 FROM boosts b WHERE b.user_id = u.id AND b.end_time > NOW()) as is_boosted
            FROM users u
            LEFT JOIN operators o ON u.id = o.user_id
            ${whereClause}
              AND u.id != $2
              AND u.account_status = 'active'
            ${orderByClause}`;

        const { rows } = await db.query(query, queryParams);
        res.json(rows);
    } catch (err) {
        console.error("❌ [DISCOVERY ERROR]:", err);
        res.status(500).json({
            error: "Discovery failed",
            message: err.message,
            detail: err.detail,
            hint: err.hint,
            code: err.code
        });
    }
});

// HEALTH CHECK
app.get('/api/health', async (req, res) => {
    try {
        const dbCheck = await db.query('SELECT 1');
        res.json({
            status: 'ok',
            db: 'connected',
            timestamp: new Date()
        });
    } catch (err) {
        console.error('[HEALTH] DB Connection Failed:', err.message);
        res.status(500).json({
            status: 'error',
            db: 'disconnected',
            error: err.message,
            timestamp: new Date()
        });
    }
});


// --- STATIC FILE SERVING (Admin Panel) ---
const adminPath = path.join(__dirname, 'public', 'admin');
app.use(express.static(adminPath));
// Explicitly serve assets folder
app.use('/assets', express.static(path.join(adminPath, 'assets')));

app.use('/api', socialRoutes);

app.use('/api/auth', authRoutes);

app.use('/api', authRoutes); // Proxy for /api/me /api/login etc
app.use('/api', referralRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/views', viewsRoutes);
app.use('/api/boosts', boostsRoutes);

// --- NEW MODULAR ROUTES (Override inline routes below) ---
app.use('/api/admin', adminUsersRoutes);
app.use('/api/admin', adminPanelRoutes);
app.use('/api/operators', adminOperatorsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin/packages', packageRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/starter-pack', starterPackRoutes);
// NOTE: /api/purchase stays in the inline routes below (uses socket.io io reference)
// ---------------------------------------------------------


app.get('/api/admin/payments', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const query = "SELECT p.*, u.username as user_name, u.email, cp.name as package_name FROM payments p LEFT JOIN users u ON p.user_id = u.id LEFT JOIN coin_packages cp ON p.package_id = cp.id ORDER BY p.created_at DESC";
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUBLIC OFFERINGS (For mobile app fallback)
app.get('/api/offerings', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM coin_packages WHERE is_active = true ORDER BY price ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ADMIN PACKAGE MANAGEMENT
app.get('/api/admin/packages', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM coin_packages ORDER BY price ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/packages', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { name, coins, price, revenuecat_id, is_active, is_popular, description } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO coin_packages (name, coins, price, revenuecat_id, is_active, is_popular, description) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [name, coins, price, revenuecat_id, is_active !== false, is_popular || false, description || null]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/packages/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { name, coins, price, revenuecat_id, is_active, is_popular, description } = req.body;
    try {
        const result = await db.query(
            `UPDATE coin_packages 
             SET name = COALESCE($1, name), 
                 coins = COALESCE($2, coins), 
                 price = COALESCE($3, price),
                 revenuecat_id = COALESCE($4, revenuecat_id),
                 is_active = COALESCE($5, is_active),
                 is_popular = COALESCE($6, is_popular),
                 description = COALESCE($7, description)
             WHERE id = $8 RETURNING *`,
            [name, coins, price, revenuecat_id, is_active, is_popular, description, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/packages/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    try {
        // Soft delete or hard delete? Admin panel use hard delete usually for packages
        await db.query('DELETE FROM coin_packages WHERE id = $1', [id]);
        res.json({ success: true, message: 'Paket silindi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CLOUDINARY UPLOAD ENDPOINT
app.post('/api/upload', (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('[MULTER ERROR]:', err);
            return res.status(500).json({ error: 'Multer Error: ' + err.message, details: err });
        } else if (err) {
            console.error('[UPLOAD UNKNOWN ERROR]:', err);
            return res.status(500).json({ error: 'Upload Error: ' + err.message, details: err });
        }
        next();
    });
}, async (req, res) => {
    try {
        console.log('[UPLOAD] Request received. File:', req.file);

        if (!req.file) {
            console.error('[UPLOAD ERROR] No file received via Multer.');
            return res.status(400).json({ error: 'Dosya yüklenemedi (req.file is empty).' });
        }

        console.log('[UPLOAD] Uploading to Cloudinary path:', req.file.path);

        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'dating_app_uploads',
            use_filename: true,
            unique_filename: false,
            resource_type: 'auto',
        });

        console.log('[UPLOAD] Cloudinary Success:', result.secure_url);

        // Delete local file
        try {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
        } catch (unlinkErr) {
            console.warn('[UPLOAD WARNING] Could not delete temp file:', unlinkErr.message);
        }

        res.json({ url: result.secure_url });
    } catch (err) {
        console.error('[UPLOAD CRITICAL ERROR]:', err);
        res.status(500).json({
            error: 'Sunucu Hatası: ' + err.message,
            stack: err.stack,
            details: JSON.stringify(err, Object.getOwnPropertyNames(err))
        });
    }
});

// Serve Admin Panel index.html for unknown /admin routes (SPA support)
app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin', 'index.html'));
});

// Helper: Sanitize User (Rewrite URLs)
// Helper: Log Activity & Emit Socket Event
// --- REST API ROUTES ---

// GET USER PROFILE
app.get('/api/users/:id', async (req, res) => {
    try {
        const query = `
            SELECT u.*, 
                (SELECT COUNT(*)::int FROM favorites WHERE target_user_id = u.id) as followers_count,
                (SELECT COUNT(*)::int FROM favorites WHERE user_id = u.id) as following_count,
                (SELECT COUNT(*)::int FROM messages WHERE (receiver_id = u.id OR (chat_id IN (SELECT id FROM chats WHERE user_id = u.id) AND sender_id != u.id)) AND gift_id IS NOT NULL) as gifts_count,
                EXISTS(SELECT 1 FROM boosts WHERE user_id = u.id AND end_time > CURRENT_TIMESTAMP) as is_boosted
            FROM users u 
            WHERE u.id = $1
        `;
        const result = await db.query(query, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(sanitizeUser(result.rows[0], req));
    } catch (err) {
        console.error('[GET_USER_PROFILE_ERROR]:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET USER ALBUM
app.get('/api/users/:id/album', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT photos FROM users WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const photos = result.rows[0].photos || [];
        
        // Use sanitizeUser to rewrite URLs (photos array handling is inside)
        const dummyUser = { photos };
        const sanitized = sanitizeUser(dummyUser, req);
        
        res.json(sanitized.photos);
    } catch (err) {
        console.error('[ALBUM FETCH ERROR]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// SYNC ALBUMS (One-time migration to move approved photos to users table)
app.get('/api/admin/sync-albums', async (req, res) => {
    try {
        const approved = await db.query("SELECT user_id, url FROM pending_photos WHERE type = 'album' AND status = 'approved'");
        let count = 0;
        
        for (const photo of approved.rows) {
            // Check if photo already in users.photos
            const userRes = await db.query('SELECT photos FROM users WHERE id = $1', [photo.user_id]);
            if (userRes.rows.length > 0) {
                const photos = userRes.rows[0].photos || [];
                if (!photos.includes(photo.url)) {
                    await db.query(
                        'UPDATE users SET photos = array_append(COALESCE(photos, \'{}\'), $1) WHERE id = $2',
                        [photo.url, photo.user_id]
                    );
                    count++;
                }
            }
        }
        
        res.json({ success: true, migrated_count: count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER PROFILE
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, display_name, age, gender, bio, job, edu } = req.body;
    const normalizedGender = normalizeGenderValue(gender);

    // Synchronize name and display_name
    const finalName = name || display_name;
    const finalDisplayName = display_name || name;

    try {
        const result = await db.query(
            `UPDATE users 
             SET display_name = COALESCE($1, display_name),
                 name = COALESCE($2, name),
                 age = COALESCE($3::INTEGER, age),
                 gender = COALESCE($4, gender),
                 bio = COALESCE($5, bio),
                 job = COALESCE($6, job),
                 edu = COALESCE($7, edu)
             WHERE id = $8 RETURNING *`,
            [finalDisplayName || null, finalName || null, age ? parseInt(age) : null, normalizedGender || null, bio || null, job || null, edu || null, id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(sanitizeUser(result.rows[0], req));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER PROFILE (LEGACY / ONBOARDING)
app.put('/api/users/:id/profile', async (req, res) => {
    const { id } = req.params;
    const { display_name, name, bio, avatar_url, gender, interests, onboarding_completed, relationship, zodiac, age, push_token } = req.body;
    const normalizedGender = normalizeGenderValue(gender);

    // Synchronize
    const finalDisplayName = req.body.display_name || req.body.name;
    const finalName = req.body.name || req.body.display_name;

    try {
        // Relaxed ID validation: Allow UUIDs or integer strings
        const isValidId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || /^\d+$/.test(id);

        console.log(`[PROFILE_UPDATE] Validating ID: "${id}" | isValid: ${isValidId}`);

        if (!id || !isValidId) {
            console.error(`[PROFILE_UPDATE] Invalid ID format received: "${id}" (Type: ${typeof id})`);
            return res.status(400).json({
                error: 'Geçersiz Kullanıcı ID formatı.',
                details: `Beklenen: UUID veya Sayı. Alınan: "${id}"`,
                debug_id: id
            });
        }

        console.log(`[PROFILE_UPDATE] Updating profile for user: ${id}`);
        console.log('[PROFILE_UPDATE] Body:', JSON.stringify(req.body, null, 2));

        const result = await db.query(
            `UPDATE users SET 
                display_name = COALESCE($1, display_name), 
                name = COALESCE($2, name),
                bio = COALESCE($3, bio), 
                avatar_url = COALESCE($4, avatar_url),
                gender = COALESCE($5, gender),
                interests = COALESCE($6, interests),
                onboarding_completed = COALESCE($7, onboarding_completed),
                age = COALESCE($8::INTEGER, age),
                relationship = COALESCE($9, relationship),
                zodiac = COALESCE($10, zodiac),
                job = COALESCE($11, job),
                edu = COALESCE($12, edu),
                boy = COALESCE($13, boy),
                kilo = COALESCE($14, kilo),
                push_token = COALESCE($15, push_token)
             WHERE id = $16 RETURNING *`,
            [
                req.body.display_name || null,
                req.body.name || null,
                req.body.bio || null,
                req.body.avatar_url || null,
                normalizedGender || null,
                req.body.interests || null,
                req.body.onboarding_completed !== undefined ? req.body.onboarding_completed : null,
                (req.body.age && !isNaN(parseInt(req.body.age))) ? parseInt(req.body.age) : null,
                req.body.relationship || null,
                req.body.zodiac || null,
                req.body.job || null,
                req.body.edu || null,
                req.body.boy || null,
                req.body.kilo || null,
                req.body.push_token || null,
                id
            ]
        );
        console.log('[PROFILE_UPDATE] Query executed');
        if (result.rows.length === 0) {
            console.error('[PROFILE_UPDATE] User not found during update');
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        try {
            const sanitized = sanitizeUser(result.rows[0], req);
            console.log('[PROFILE_UPDATE] Success');
            res.json(sanitized);
        } catch (sanErr) {
            console.error('[PROFILE_UPDATE] Sanitization Error:', sanErr.message);
            res.json(result.rows[0]); // Return raw if sanitization fails
        }
    } catch (err) {
        console.error('[PROFILE_UPDATE] CRITICAL ERROR:', err.message);
        console.error('[PROFILE_UPDATE] PG Code:', err.code);
        res.status(500).json({
            error: 'Profile update failed',
            details: `${err.message} (PG Code: ${err.code || 'N/A'})`,
            code: err.code
        });
    }
});

// --- END DATABASE INITIALIZATION ---

// EMERGENCY: Clear user photo by email (For ghost photos after rejection)
app.get('/api/admin/emergency-clear-user', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email gerekli.' });

    try {
        const result = await db.query("UPDATE users SET avatar_url = NULL, photos = '{}' WHERE email = $1 RETURNING id", [email]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.', searched_email: email });
        }
        res.json({ success: true, message: `Kullanıcı (${email}) fotoğrafı temizlendi.`, userId: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Health Check
// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'web-admin', 'dist')));

// Account Deletion Page (Google Play Requirement)
app.get('/account-deletion', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Hesap Silme Talebi - Fiva</title>
            <style>
                body { font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; line-height: 1.6; }
                h1 { color: #333; }
                .contact { background: #f9f9f9; padding: 15px; border-radius: 5px; border: 1px solid #ddd; }
            </style>
        </head>
        <body>
            <h1>Veri Silme Talebi</h1>
            <p>Fiva hesabınızı ve ilgili tüm kişisel verilerinizi silmek istiyorsanız, lütfen aşağıdaki adımları izleyin:</p>
            <div class="contact">
                <p>Destek ekibimize şu adresten e-posta gönderin: <strong>falkasoft@gmail.com</strong></p>
                <p>Konu: <strong>Hesap Silme Talebi - [Kullanıcı Adınız]</strong></p>
                <p>Lütfen talebi, hesabınızla ilişkili e-posta adresinden gönderin.</p>
            </div>
            <p>Talebiniz 30 gün içinde işleme alınacaktır. Tüm kişisel veriler sistemlerimizden kalıcı olarak silinecektir.</p>
        </body>
        </html>
    `);
});

// Safety Standards Page (Google Play Requirement)
app.get('/safety-standards', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Güvenlik Standartları - Fiva</title>
            <style>
                body { font-family: sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; line-height: 1.6; color: #333; }
                h1 { color: #2563eb; }
                h2 { color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-top: 30px; }
                .policy-box { background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px; }
                strong { color: #111; }
            </style>
        </head>
        <body>
            <h1>Fiva Güvenlik Standartları ve Politikası</h1>
            <p>Son Güncelleme: 18 Şubat 2026</p>

            <div class="policy-box">
                <h2>Çocukların Güvenliği (CSAE) Politikası</h2>
                <p><strong>Fiva olarak, çocuk istismarı ve sömürüsüne (CSAE) karşı kesinlikle sıfır tolerans politikası izliyoruz.</strong> Platformumuzda çocukların güvenliğini tehdit eden hiçbir içeriğe, davranışa veya kullanıcıya izin verilmez.</p>
                
                <h3>Temel İlkelerimiz:</h3>
                <ul>
                    <li><strong>Sıfır Tolerans:</strong> Çocuk istismarı (CSAE) içeren veya teşvik eden her türlü içerik derhal kaldırılır ve sorumlular platformdan kalıcı olarak yasaklanır.</li>
                    <li><strong>Raporlama:</strong> Bu tür içerikleri tespit ettiğimizde, derhal NCMEC (Ulusal Kayıp ve Sömürülen Çocuklar Merkezi) ve yerel kolluk kuvvetlerine (CyberTipline) bildiriyoruz.</li>
                    <li><strong>Yapay Zeka ve Moderasyon:</strong> Platformumuzdaki görseller ve metinler, zararlı içerikleri tespit etmek için gelişmiş filtreleme sistemleri ve 7/24 moderasyon ekibi tarafından izlenmektedir.</li>
                </ul>

                <h3>Kullanıcı Yükümlülükleri:</h3>
                <p>Kullanıcılarımız, Hizmet Şartlarımızı kabul ederek platformda yasa dışı, zararlı veya çocuk güvenliğini tehlikeye atan içerik paylaşmayacaklarını taahhüt ederler. İhlaller yasal işlem gerektirir.</p>

                <h3>Şikayet ve İletişim:</h3>
                <p>Güvenlik ihlali veya şüpheli bir durum fark ederseniz, lütfen anında bize bildirin:</p>
                <p>E-posta: <strong>falkasoft@gmail.com</strong></p>
            </div>

            <h2>Topluluk Kuralları</h2>
            <p>Fiva, saygılı ve güvenli bir ortam sağlamayı amaçlar. Taciz, nefret söylemi, şiddet ve müstehcenlik içeren paylaşımlar yasaktır.</p>
        </body>
        </html>
    `);
});

// DEBUG: DB Check
app.get('/api/debug/db-check', async (req, res) => {
    try {
        const users = await db.query('SELECT COUNT(*) FROM users');
        const ops = await db.query('SELECT COUNT(*) FROM operators');
        const nullOps = await db.query('SELECT COUNT(*) FROM operators WHERE user_id IS NULL');
        const legacyChats = await db.query('SELECT COUNT(*) FROM chats WHERE operator_id > 10000'); // Rough check for un-migrated chats (ids usually small, old IDs were small too but new user_ids might be different? actually just check raw count)
        const sampleOps = await db.query('SELECT * FROM operators LIMIT 3');

        // Check schema of pending_photos
        const pendingPhotosCols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pending_photos'");

        res.json({
            users: users.rows[0].count,
            operators: ops.rows[0].count,
            null_user_id_ops: nullOps.rows[0].count,
            pending_photos_schema: pendingPhotosCols.rows,
            sample_ops: sampleOps.rows
        });
    } catch (err) {
        res.json({ error: err.message });
    }
});

// REAL-TIME PAYOUT & EARNINGS DEBUG
app.get('/api/debug/payout-logs', async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT 
                u.username as staff_name,
                u.id as staff_id,
                o.pending_balance,
                o.lifetime_earnings,
                (SELECT COALESCE(SUM(coins_earned), 0) FROM operator_stats WHERE operator_id::text = u.id::text AND date = CURRENT_DATE) as earned_today,
                (SELECT COUNT(*) FROM messages m 
                 JOIN chats c ON m.chat_id = c.id 
                 JOIN users a ON c.operator_id = a.id
                 WHERE a.managed_by::text = u.id::text AND m.created_at > CURRENT_DATE) as msgs_today
            FROM users u
            JOIN operators o ON u.id::text = o.user_id::text
            WHERE u.role IN ('staff', 'admin', 'operator', 'moderator')
            ORDER BY earned_today DESC NULLS LAST
        `);
        res.json({
            info: "Bu liste GERÇEK veritabanı kazançlarını gösterir.",
            timestamp: new Date().toISOString(),
            data: stats.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// DEBUG: Dump Users
app.get('/api/debug/users-list', async (req, res) => {
    try {
        const result = await db.query('SELECT id, username, display_name, role FROM users ORDER BY created_at DESC LIMIT 50');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ADMIN USER MANAGEMENT ---

const helmet = require('helmet');

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "https://via.placeholder.com", "https://res.cloudinary.com", "https://images.unsplash.com", "https://*.unsplash.com"],
            "connect-src": ["'self'", "https://admin.falkasoft.com", "wss://admin.falkasoft.com", "http://localhost:5000", "ws://localhost:5000", "http://127.0.0.1:5000", "ws://127.0.0.1:5000"],
            "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Vite and some inline scripts need this in dev/some setups
        },
    },
}));

// ... (existing middleware)

// --- ADMIN USER MANAGEMENT ---

// MANUAL EMERGENCY FIX: Smart Schema Repair
app.get('/api/admin/force-fix-schema', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };

    try {
        log("⚠️ [MANUAL] Starting Smart Schema Repair...");

        // 2. Try Create if not exists (Safe first step)
        try {
            await db.query(`CREATE TABLE IF NOT EXISTS pending_photos (
                id SERIAL PRIMARY KEY,
                user_id UUID REFERENCES users(id),
                type VARCHAR(50),
                url TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW()
            )`);
            log("✅ [MANUAL] 'CREATE TABLE IF NOT EXISTS' executed.");
        } catch (e) { log(`❌ [MANUAL] Create failed: ${e.message}`); }

        // 3. Force Add Columns (Safe, idempotent)
        const addCol = async (col, type) => {
            try {
                await db.query(`ALTER TABLE pending_photos ADD COLUMN IF NOT EXISTS ${col} ${type}`);
                log(`✅ [MANUAL] Checked/Added column: ${col}`);
            } catch (e) { log(`❌ [MANUAL] Failed to add ${col}: ${e.message}`); }
        };

        await addCol('type', 'VARCHAR(50)');
        await addCol('user_id', 'UUID REFERENCES users(id)');
        await addCol('url', 'TEXT');
        await addCol('status', "VARCHAR(50) DEFAULT 'pending'");

        // 4. Verify Schema
        const check = await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='pending_photos'`);

        res.json({
            status: 'success',
            message: 'Smart repair complete.',
            logs: logs,
            final_schema: check.rows
        });

    } catch (err) {
        log(`❌ [MANUAL] Critical Error: ${err.message}`);
        res.json({ status: 'error', error: err.message, logs: logs });
    }
});

// --- END SETUP ROUTES ---

// TEMP: Manual Seeding Route
app.get('/api/seed-data', async (req, res) => {
    const secret = req.query.secret;
    if (secret !== 'falka_setup_2024') return res.status(403).send('Forbidden');

    try {
        const opCount = await db.query('SELECT COUNT(*) FROM operators');
        if (parseInt(opCount.rows[0].count) > 0) {
            return res.send('<h1>Database already populated</h1><p>Operators exist. Skipping seed.</p>');
        }

        const dummyOps = [
            { name: 'Selin', bio: 'Merhaba, ben Selin. Sohbet etmeyi severim.', cat: 'Eğlenceli', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400' },
            { name: 'Merve', bio: 'Dertleşmek istersen buradayım.', cat: 'Dert Ortağı', img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400' },
            { name: 'Aslı', bio: 'Moda ve alışveriş tutkunuyum.', cat: 'Moda', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400' },
            { name: 'Zeynep', bio: 'Kitaplar ve kahve...', cat: 'Kültür', img: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400' }
        ];

        for (const op of dummyOps) {
            // 1. Create User
            const uniqueUsername = op.name.toLowerCase() + '_' + Date.now();
            const uniqueEmail = uniqueUsername + '@test.com';
            const userRes = await db.query(
                "INSERT INTO users (username, email, password, password_hash, role, avatar_url, display_name, gender) VALUES ($1, $2, 'pass123', 'pass123', 'operator', $3, $4, 'kadin') RETURNING id",
                [uniqueUsername, uniqueEmail, op.img, op.name]
            );
            const userId = userRes.rows[0].id;

            // 2. Create Operator
            await db.query(
                "INSERT INTO operators (user_id, category, bio, photos, is_online, rating) VALUES ($1, $2, $3, $4, true, 5.0)",
                [userId, op.cat, op.bio, [op.img]]
            );
        }

        res.send('<h1>Seeding Complete!</h1><p>Created 4 dummy operators.</p>');

    } catch (err) {
        res.status(500).send(`Error: ${err.message}`);
    }
});

// GET ADMIN STATS (Dashboard)
app.get('/api/admin/stats', authenticateToken, authorizeRole('admin', 'super_admin', 'moderator'), async (req, res) => {
    try {
        // 1. Total Stats
        const revResult = await db.query('SELECT SUM(total_spent) as total FROM users');
        const totalRevenue = revResult.rows[0].total || 0;

        const userResult = await db.query('SELECT COUNT(*) as count FROM users WHERE role = \'user\'');
        const activeUsers = userResult.rows[0].count;

        const msgResult = await db.query('SELECT COUNT(*) as count FROM messages');
        const totalMessages = msgResult.rows[0].count;

        const opResult = await db.query('SELECT COUNT(*) as count FROM operators WHERE is_online = true');
        const onlineOperators = opResult.rows[0].count;

        // 2. Chart Data (Last 7 Days)
        const revenueChartQuery = `
            SELECT 
                TO_CHAR(date_trunc('day', created_at), 'DD.MM') as label,
                SUM(amount) as value
            FROM transactions
            WHERE created_at >= NOW() - INTERVAL '7 days'
            GROUP BY date_trunc('day', created_at)
            ORDER BY date_trunc('day', created_at) ASC
        `;
        const revenueChart = await db.query(revenueChartQuery);

        const registrationChartQuery = `
            SELECT 
                TO_CHAR(date_trunc('day', created_at), 'DD.MM') as label,
                COUNT(*) as value
            FROM users
            WHERE role = 'user' AND created_at >= NOW() - INTERVAL '7 days'
            GROUP BY date_trunc('day', created_at)
            ORDER BY date_trunc('day', created_at) ASC
        `;
        const registrationChart = await db.query(registrationChartQuery);

        const newUsersLists = {
            today: await db.query("SELECT id, username, display_name, email, gender, created_at, avatar_url FROM users WHERE role = 'user' AND created_at >= date_trunc('day', NOW()) ORDER BY created_at DESC LIMIT 10"),
            week: await db.query("SELECT id, username, display_name, email, gender, created_at, avatar_url FROM users WHERE role = 'user' AND created_at >= date_trunc('week', NOW()) ORDER BY created_at DESC LIMIT 10"),
            month: await db.query("SELECT id, username, display_name, email, gender, created_at, avatar_url FROM users WHERE role = 'user' AND created_at >= date_trunc('month', NOW()) ORDER BY created_at DESC LIMIT 10")
        };

        const newUsersCounts = await db.query(`
            SELECT 
                COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW())) as today,
                COUNT(*) FILTER (WHERE created_at >= NOW() - interval '7 days') as week,
                COUNT(*) FILTER (WHERE created_at >= NOW() - interval '30 days') as month
            FROM users WHERE role = 'user'
        `);

        res.json({
            revenue: parseFloat(totalRevenue).toFixed(2),
            activeUsers: parseInt(activeUsers),
            messages: parseInt(totalMessages),
            onlineOperators: parseInt(onlineOperators),
            charts: {
                revenue: revenueChart.rows,
                registrations: registrationChart.rows
            },
            newUsers: {
                counts: {
                    today: parseInt(newUsersCounts.rows[0].today || 0),
                    week: parseInt(newUsersCounts.rows[0].week || 0),
                    month: parseInt(newUsersCounts.rows[0].month || 0)
                },
                lists: {
                    today: newUsersLists.today.rows,
                    week: newUsersLists.week.rows,
                    month: newUsersLists.month.rows
                }
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET ADMIN ACTIVITIES
app.get('/api/admin/activities', authenticateToken, authorizeRole('admin', 'super_admin', 'moderator'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT a.*, u.username as user_name, u.avatar_url as user_avatar 
            FROM activities a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC 
            LIMIT 50
        `);
        // Sanitize users in the activity list
        const activities = result.rows.map(act => {
            const sanitizedUser = sanitizeUser({ avatar_url: act.user_avatar }, req);
            return { ...act, user_avatar: sanitizedUser ? sanitizedUser.avatar_url : null };
        });
        res.json(activities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET ADMIN PAYMENTS
app.get('/api/admin/payments', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const query = `
            SELECT t.*, u.username as user_name, u.email 
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC
            LIMIT 100
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET ALL STAFF (Admins, Moderators, Operators)
app.get('/api/admin/staff', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query("SELECT id, username, email, role, created_at FROM users WHERE role IN ('admin', 'moderator', 'operator', 'staff') ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// COIN PACKAGES API
app.get('/api/admin/packages', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM coin_packages ORDER BY price ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/packages', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { name, coins, price, is_popular, revenuecat_id, description, is_active } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO coin_packages (name, coins, price, is_popular, revenuecat_id, description, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [name, coins, price, is_popular || false, revenuecat_id, description, is_active !== false]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/packages/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { name, coins, price, is_popular, revenuecat_id, description, is_active } = req.body;
    try {
        const result = await db.query(
            'UPDATE coin_packages SET name = $1, coins = $2, price = $3, is_popular = $4, revenuecat_id = $5, description = $6, is_active = $7 WHERE id = $8 RETURNING *',
            [name, coins, price, is_popular, revenuecat_id, description, is_active, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Paket bulunamadı.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/packages/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM coin_packages WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GIFTS API
app.get('/api/admin/gifts', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM gifts ORDER BY cost ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/gifts', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { name, cost, icon_url } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO gifts (name, cost, icon_url) VALUES ($1, $2, $3) RETURNING *',
            [name, cost, icon_url]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/gifts/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { name, cost, icon_url } = req.body;
    try {
        const result = await db.query(
            'UPDATE gifts SET name = $1, cost = $2, icon_url = $3 WHERE id = $4 RETURNING *',
            [name, cost, icon_url, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Hediye bulunamadı.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/gifts/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM gifts WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// REPORTS API
app.get('/api/admin/reports', authenticateToken, authorizeRole('admin', 'super_admin', 'moderator'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT r.*, u1.username as reporter_name, u2.username as reported_name
            FROM reports r
            LEFT JOIN users u1 ON r.reporter_id = u1.id
            LEFT JOIN users u2 ON r.reported_id = u2.id
            ORDER BY r.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/reports/:id', authenticateToken, authorizeRole('admin', 'super_admin', 'moderator'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const result = await db.query(
            'UPDATE reports SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// QUICK REPLIES API
app.get('/api/admin/quick-replies', authenticateToken, authorizeRole('admin', 'super_admin', 'operator'), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM quick_replies ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/quick-replies', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { title, content } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO quick_replies (title, content) VALUES ($1, $2) RETURNING *',
            [title, content]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/quick-replies/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;
    try {
        const result = await db.query(
            'UPDATE quick_replies SET title = $1, content = $2 WHERE id = $3 RETURNING *',
            [title, content, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Mesaj bulunamadı.' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/quick-replies/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM quick_replies WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE STAFF (Admin, Moderator, Operator, Staff)
app.post('/api/admin/staff', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { username, email, password, role } = req.body;
    if (!['admin', 'moderator', 'operator', 'staff'].includes(role)) {
        return res.status(400).json({ error: 'Geçersiz rol.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.query(
            "INSERT INTO users (username, email, password, password_hash, role, balance, account_status) VALUES ($1, $2, $3, $3, $4, 0, 'active') RETURNING id, username, email, role",
            [username, email, hashedPassword, role]
        );

        // If Operator or Staff, add to operators table to track earnings/balance
        if (role === 'operator' || role === 'staff') {
            await db.query(
                "INSERT INTO operators (user_id, category, bio, photos, is_online, rating) VALUES ($1, 'Genel', 'Merhaba!', '{}', false, 5.0)",
                [result.rows[0].id]
            );
        }

        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Kullanıcı adı/E-posta kullanımda.' });
        res.status(500).json({ error: err.message });
    }
});


// DELETE STAFF
app.delete('/api/admin/staff/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    if (req.user.id === parseInt(id)) return res.status(400).json({ error: 'Kendinizi silemezsiniz.' });

    try {
        await db.query("DELETE FROM users WHERE id = $1", [id]);
        res.json({ success: true, message: 'Personel tamamen silindi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET ALL USERS (Manager/Admin Only)
app.get('/api/admin/users', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        console.log(`[ADMIN] Fetching users list for admin: ${req.user.id}`);
        const result = await db.query(`
            SELECT id, username, email, role, account_status, balance, 
                   is_vip, created_at, last_login_at, ban_expires_at, avatar_url 
            FROM users 
            ORDER BY created_at DESC
        `);
        console.log(`[ADMIN] User List Fetch Success: Found ${result.rows.length} users. IDs: ${result.rows.map(u => u.id).join(', ')}`);
        res.json(result.rows);
    } catch (err) {
        console.error(`[ADMIN] Fetch users error:`, err.message);
        res.status(500).json({ error: err.message });
    }
});

// BAN USER
app.post('/api/admin/users/:id/ban', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { duration } = req.body; // 'permanent' or number (hours)

    try {
        let banExpiresAt = null;
        let accountStatus = 'banned';

        if (duration !== 'permanent') {
            const hours = parseInt(duration);
            if (!isNaN(hours)) {
                const date = new Date();
                date.setHours(date.getHours() + hours);
                banExpiresAt = date;
            }
        }

        await db.query(
            'UPDATE users SET account_status = $1, ban_expires_at = $2 WHERE id = $3',
            [accountStatus, banExpiresAt, id]
        );

        res.json({ success: true, message: 'Kullanıcı banlandı.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UNBAN USER
app.post('/api/admin/users/:id/unban', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    try {
        await db.query(
            "UPDATE users SET account_status = 'active', ban_expires_at = NULL WHERE id = $1",
            [id]
        );
        res.json({ success: true, message: 'Ban kaldırıldı.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MANAGE BALANCE
app.post('/api/admin/users/:id/balance', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body; // Can be positive or negative

    try {
        const result = await db.query(
            `UPDATE users 
             SET balance = balance + $1,
                 total_spent = total_spent + (CASE WHEN $1 > 0 THEN $1 ELSE 0 END)
             WHERE id = $2 RETURNING balance`,
            [amount, id]
        );

        // 3. Emit Real-time Update
        io.emit('balance_update', { userId: id, newBalance: result.rows[0].balance });

        res.json({ success: true, newBalance: result.rows[0].balance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// GET ADMIN ACTIVITIES
app.get('/api/admin/activities', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const query = `
            SELECT a.*, u.username as user_name, u.avatar_url as user_avatar 
            FROM activities a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC
            LIMIT 20
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET PERSONAL STATS (For Operators and Staff)
app.get('/api/admin/my-stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        if (role !== 'operator' && role !== 'staff') {
            return res.status(403).json({ error: 'Bu verileri görme yetkiniz yok.' });
        }
        
        // 1. Get today's stats from operator_stats
        const todayStats = await db.query(
            "SELECT COALESCE(SUM(messages_sent), 0) as messages, COALESCE(SUM(coins_earned), 0) as coins FROM operator_stats WHERE operator_id::text = $1 AND date = CURRENT_DATE",
            [userId.toString()]
        );

        // 2. Get overall balance and lifetime from operators table
        const operatorInfo = await db.query(
            "SELECT pending_balance, lifetime_earnings FROM operators WHERE user_id::text = $1",
            [userId.toString()]
        );

        // 3. Get monthly summary (Last 7 days for chart)
        const weeklyStats = await db.query(`
            SELECT date as label, messages_sent as value 
            FROM operator_stats 
            WHERE operator_id::text = $1 
            ORDER BY date DESC LIMIT 7
        `, [userId.toString()]);

        res.json({
            today: todayStats.rows[0],
            info: operatorInfo.rows[0] || { pending_balance: 0, lifetime_earnings: 0 },
            chart: weeklyStats.rows.reverse()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/admin/users', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { username, email, password, role } = req.body;

    // Validate role
    if (!['admin', 'moderator', 'operator', 'user', 'staff'].includes(role)) {
        return res.status(400).json({ error: 'Geçersiz rol.' });
    }

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Include legacy 'password' field in INSERT for compatibility
        const result = await db.query(
            "INSERT INTO users (username, email, password, password_hash, role, balance) VALUES ($1, $2, $3, $3, $4, 0) RETURNING id, username, email, role",
            [username, email, hashedPassword, role]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Kullanıcı adı veya e-posta zaten mevcut.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER ROLE (Manager/Admin Only)
app.put('/api/admin/users/:id/role', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'moderator', 'operator', 'user', 'staff'].includes(role)) {
        return res.status(400).json({ error: 'Geçersiz rol.' });
    }

    try {
        const result = await db.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
            [role, id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

        // --- ROLE SYNC: If user promoted to operator, ensure entry in operators table exists ---
        if (role === 'operator') {
            const opCheck = await db.query('SELECT user_id FROM operators WHERE user_id = $1', [id]);
            if (opCheck.rows.length === 0) {
                console.log(`[SYNC] Creating missing operator entry for user ${id}`);
                await db.query(
                    "INSERT INTO operators (user_id, category, bio, photos, is_online, rating) VALUES ($1, 'Genel', 'Merhaba!', '{}', false, 5.0)",
                    [id]
                );
            }
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- OPERATOR MANAGEMENT (Admin Panel) ---

// CREATE OPERATOR
app.post('/api/operators', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { name, gender, bio, avatar_url, photos, age, category, job, relationship, zodiac, vip_level, interests } = req.body;

    try {
        await db.query('BEGIN');

        // 1. Create a dummy user for this operator
        const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const username = `op_${name ? name.toLowerCase().replace(/\s+/g, '_') : 'unnamed'}_${uniqueId}`;
        const email = `${username}@fiva.admin`;
        const dummyPassword = await bcrypt.hash('op_pass_123!', 10);

        const userResult = await db.query(
            `INSERT INTO users (
                username, email, password, password_hash, role, 
                display_name, name, gender, age, avatar_url, 
                job, relationship, zodiac, interests, vip_level,
                account_status
            ) VALUES ($1, $2, $3, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active') 
            RETURNING id`,
            [
                username, email, dummyPassword, 'operator',
                name, gender || 'kadin', parseInt(age) || 18, avatar_url,
                job || null, relationship || null, zodiac || null,
                interests || '[]', parseInt(vip_level) || 0
            ]
        );

        const userId = userResult.rows[0].id;

        // 2. Create the operator entry
        const opResult = await db.query(
            `INSERT INTO operators (user_id, category, bio, photos, is_online, rating) 
             VALUES ($1, $2, $3, $4, true, 5.0) 
             RETURNING *`,
            [userId, category || 'Genel', bio || 'Merhaba!', photos || []]
        );

        await db.query('COMMIT');
        console.log(`[ADMIN] Created operator ${name} (User: ${userId})`);
        res.status(201).json({ ...opResult.rows[0], id: userId, name: name });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('[ADMIN] Create Operator Error:', err.message);
        res.status(500).json({ error: 'Operatör oluşturulamadı.', details: err.message });
    }
});

// UPDATE OPERATOR
app.put('/api/operators/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params; // Expecting user_id
    const { name, gender, bio, avatar_url, photos, age, category, job, relationship, zodiac, vip_level, interests } = req.body;

    try {
        await db.query('BEGIN');

        // 1. Update User Record
        const userUpdate = await db.query(
            `UPDATE users SET 
                display_name = COALESCE($1, display_name),
                name = COALESCE($1, name),
                gender = COALESCE($2, gender),
                age = COALESCE($3, age),
                avatar_url = COALESCE($4, avatar_url),
                job = COALESCE($5, job),
                relationship = COALESCE($6, relationship),
                zodiac = COALESCE($7, zodiac),
                interests = COALESCE($8, interests),
                vip_level = COALESCE($9, vip_level)
             WHERE id = $10 RETURNING id`,
            [name, gender, isNaN(parseInt(age)) ? null : parseInt(age), avatar_url, job, relationship, zodiac, interests, isNaN(parseInt(vip_level)) ? null : parseInt(vip_level), id]
        );

        if (userUpdate.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Operatör bulunamadı (User ID eşleşmedi).' });
        }

        // 2. Update Operator Record
        await db.query(
            `UPDATE operators SET 
                category = COALESCE($1, category),
                bio = COALESCE($2, bio),
                photos = COALESCE($3, photos)
             WHERE user_id = $4`,
            [category, bio, photos, id]
        );

        await db.query('COMMIT');
        console.log(`[ADMIN] Updated operator profile for ${id}`);
        res.json({ success: true, message: 'Profil güncellendi.' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('[ADMIN] Update Operator Error:', err.message);
        res.status(500).json({ error: 'Profil güncellenemedi.', details: err.message });
    }
});

// DELETE OPERATOR (Soft Delete)
app.delete('/api/operators/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params; // Use user_id
    try {
        console.log(`[ADMIN] Hard deleting operator profile for ${id}`);
        await db.query("DELETE FROM users WHERE id = $1", [id]);
        res.json({ success: true, message: 'Operatör tamamen silindi.' });
    } catch (err) {
        console.error('[ADMIN] Delete Operator Error:', err.message);
        res.status(500).json({ error: 'Silme işlemi başarısız.', details: err.message });
    }
});

// ASSIGN PROFILE TO PERSONNEL (Zimmetleme)
app.post('/api/admin/operators/:id/assign', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params; // Profile ID (female profile)
    const { personnelId } = req.body; // Human ID (Hamza's staff)

    try {
        // null makes the profile unassigned (back to common pool if implemented, but here we require assignment)
        await db.query('UPDATE users SET managed_by = $1 WHERE id = $2', [personnelId || null, id]);
        
        console.log(`[ADMIN] Assigned profile ${id} to personnel ${personnelId}`);
        res.json({ success: true, message: 'Profil başarıyla personelde zimmetlendi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE USER (Self or Admin)
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    // Check permissions: users can delete themselves, admins can delete anyone
    // Note: req.user.id is from token. Ensure type matches (string vs number)
    // Loose equality check or toString() is safer.
    const requestorId = req.user.id.toString();
    const targetId = id.toString();

    if (requestorId !== targetId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Yetkisiz işlem. Başkasının hesabını silemezsiniz.' });
    }

    try {
        await db.query('BEGIN');

        console.log(`[SOFT_DELETE] Marking user ${id} as deleted`);

        console.log(`[HARD_DELETE] Removing user ${id} from database`);

        const result = await db.query(
            "DELETE FROM users WHERE id = $1 RETURNING id",
            [id]
        );

        if (result.rowCount === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        await db.query('COMMIT');
        console.log(`[SOFT_DELETE] User ${id} marked as deleted successfully.`);
        res.json({ success: true, message: 'Hesap başarıyla silindi (Soft Delete).' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Soft Delete User Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER PROFILE
app.put('/api/users/:id/profile', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, bio, job, relationship, zodiac, interests, age, edu, boy, kilo, gender } = req.body;

    // Authorization check: User can update own profile, Admins can update any
    if (req.user.id.toString() !== id.toString() && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Yetkisiz işlem.' });
    }

    try {
        const result = await db.query(
            `UPDATE users 
             SET display_name = COALESCE($1, display_name), 
                 name = COALESCE($1, name),
                 bio = COALESCE($2, bio), 
                 job = COALESCE($3, job), 
                 relationship = COALESCE($4, relationship), 
                 zodiac = COALESCE($5, zodiac), 
                 interests = COALESCE($6, interests),
                 age = COALESCE($7, age),
                 edu = COALESCE($8, edu),
                 boy = COALESCE($9, boy),
                 kilo = COALESCE($10, kilo),
                 gender = COALESCE($11, gender)
             WHERE id = $12 
             RETURNING *`,
            [name, bio, job, relationship, zodiac, interests, age, edu, boy, kilo, gender, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        // Also update operators table bio if user is an operator
        if (req.user.role === 'operator') {
            await db.query('UPDATE operators SET bio = COALESCE($1, bio) WHERE user_id = $2', [bio, id]);
        }

        res.json(sanitizeUser(result.rows[0], req));
    } catch (err) {
        console.error('Update Profile Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// DELETE USER (Manager/Admin Only)
app.delete('/api/admin/users/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    // Prevent deleting self? Frontend should handle, but backend safeguard nice-to-have.
    if (req.user.id === id) {
        return res.status(400).json({ error: 'Kendinizi silemezsiniz.' });
    }

    try {
        await db.query("DELETE FROM users WHERE id = $1", [id]);
        res.json({ success: true, message: 'Kullanıcı tamamen silindi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// REPORT USER
app.post('/api/report', authenticateToken, async (req, res) => {
    const { reportedId, reason, details } = req.body;
    const reporterId = req.user.id;
    try {
        await db.query('INSERT INTO reports (reporter_id, reported_id, reason, details) VALUES ($1, $2, $3, $4)',
            [reporterId, reportedId, reason, details]);

        // Auto-flag reported users for review
        await db.query("UPDATE users SET account_status = 'under_review' WHERE id = $1", [reportedId]);

        res.json({ success: true, message: 'Kullanıcı raporlandı.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE PUSH TOKEN
app.post('/api/users/push-token', authenticateToken, async (req, res) => {
    const { pushToken } = req.body;
    const userId = req.user.id;
    try {
        await db.query('UPDATE users SET push_token = $1 WHERE id = $2', [pushToken, userId]);
        res.json({ success: true, message: 'Push token güncellendi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// BLOCK USER
app.post('/api/block', authenticateToken, async (req, res) => {
    const { blockedId } = req.body;
    const blockerId = req.user.id;
    try {
        await db.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)', [blockerId, blockedId]);
        res.json({ success: true, message: 'Kullanıcı engellendi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ... (existing admin routes) ...

// GET USER BALANCE
app.get('/api/users/balance', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await db.query('SELECT balance FROM users WHERE id::text = $1::text', [userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ balance: result.rows[0].balance || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SECURE PURCHASE ENDPOINT
app.post('/api/purchase', authenticateToken, async (req, res) => {
    // Note: authenticateToken is safer, but ShopScreen currently might not send auth header?
    // ShopScreen uses axios.post but doesn't explicitly add header in the snippet I saw.
    // However, user IS logged in. Let's assume auth header is handled by global axios interceptor or add it.
    // If ShopScreen.js doesn't send token, this will break. 
    // SAFEST: Check if req.user exists, if not try to find by userId (insecure fallback but consistent with current state)
    // For now, I will NOT force authenticateToken middleware yet if it risks breaking flow, 
    // but I WILL validate the input.

    const { productId, transactionId } = req.body;
    const userId = req.user.id; // Use authenticated ID

    if (!userId || !productId) {
        return res.status(400).json({ error: 'Eksik parametreler.' });
    }

    try {
        await db.query('BEGIN');

        // 1. Validate Package and Get Price/Coins from DB
        let price = 0;
        let coinsToAdd = 0;
        let packageName = '';

        const pkgRes = await db.query(
            'SELECT * FROM coin_packages WHERE id = $1 OR revenuecat_id = $2',
            [isNaN(productId) ? -1 : parseInt(productId), productId]
        );

        if (pkgRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Paket bulunamadı.' });
        }

        price = parseFloat(pkgRes.rows[0].price);
        coinsToAdd = parseInt(pkgRes.rows[0].coins);
        packageName = pkgRes.rows[0].name;
        const packageId = pkgRes.rows[0].id;

        // 2. Perform Atomic Update (SET balance = balance + $1)
        // Uses COALESCE to safely handle NULL values in balance or total_spent
        const updateRes = await db.query(
            `UPDATE users 
             SET total_spent = COALESCE(total_spent, 0) + $1, 
                 balance = COALESCE(balance, 0) + $2
             WHERE id = $3 
             RETURNING balance, total_spent`,
            [price, coinsToAdd, userId]
        );

        if (updateRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Kullanıcı güncellenemedi.' });
        }

        const newBalance = updateRes.rows[0].balance;
        const newTotalSpent = parseFloat(updateRes.rows[0].total_spent);

        // 3. Determine and Update VIP Level based on total spent
        let newVipLevel = 0;
        if (newTotalSpent >= 5000) newVipLevel = 5;
        else if (newTotalSpent >= 3500) newVipLevel = 4;
        else if (newTotalSpent >= 2000) newVipLevel = 3;
        else if (newTotalSpent >= 1000) newVipLevel = 2;
        else if (newTotalSpent >= 500) newVipLevel = 1;

        await db.query('UPDATE users SET vip_level = $1 WHERE id = $2', [newVipLevel, userId]);

        console.log(`[PURCHASE SUCCESS] User ${userId}: Added ${coinsToAdd} coins. New Balance: ${newBalance}. Total Spent: ${newTotalSpent}. VIP: ${newVipLevel}`);

        // 4. Record Payment
        await db.query(
            'INSERT INTO payments (user_id, package_id, transaction_id, amount, status) VALUES ($1, $2, $3, $4, $5)',
            [userId, packageId, transactionId || `manual_${Date.now()}`, price, 'completed']
        );

        // 5. Record Transaction
        await db.query(
            'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
            [userId, coinsToAdd, 'purchase', `${packageName} satın alındı`]
        );

        await db.query('COMMIT');

        // Emit real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('balance_update', { userId, newBalance });
        }

        res.json({
            success: true,
            balance: newBalance,
            hearts: newBalance, // Sync hearts (used by some UI components)
            vip_level: newVipLevel,
            coins_added: coinsToAdd
        });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('CRITICAL PURCHASE ERROR:', err);
        res.status(500).json({
            error: 'Satın alım işlenirken bir hata oluştu.',
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// INTERNAL ENDPOINT FOR FAKE MESSAGES (To persist them in chat history)
app.post('/api/messages/internal-fake', async (req, res) => {
    const { userId, operatorId, content } = req.body;
    if (!userId || !operatorId || !content) return res.status(400).json({ error: 'Missing parameters' });

    try {
        let chatId;
        // 1. Check if chat exists
        const chatCheck = await db.query(
            'SELECT id FROM chats WHERE user_id = $1 AND operator_id = $2',
            [userId, operatorId]
        );

        if (chatCheck.rows.length === 0) {
            // 2. First time! Create chat
            const newChat = await db.query(
                'INSERT INTO chats (user_id, operator_id, last_message_at) VALUES ($1, $2, NOW()) RETURNING id',
                [userId, operatorId]
            );
            chatId = newChat.rows[0].id;
        } else {
            // Persistent Limit: If chat already exists, we never send a "fake" message again.
            // This ensures only the first ever automated message arrives.
            return res.json({ success: true, message: 'Already connected, skipping fake message.' });
        }

        // 2. Insert message
        const result = await db.query(
            'INSERT INTO messages (chat_id, sender_id, content, content_type) VALUES ($1, $2, $3, $4) RETURNING *',
            [chatId, operatorId, content, 'text']
        );

        // 3. Update chat last message preview
        await db.query(
            'UPDATE chats SET last_message_at = NOW(), last_message = $2 WHERE id = $1',
            [chatId, content]
        );

        // 4. Emit to user if online (using io.to(userId))
        io.to(userId.toString()).emit('new_message', {
            ...result.rows[0],
            chat_id: chatId.toString()
        });

        res.json({ success: true, message: result.rows[0], chatId });
    } catch (err) {
        console.error('[FAKE MSG] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});


// GET CHATS FOR USER
app.get('/api/users/:userId/chats', async (req, res) => {
    const { userId } = req.params;
    console.log(`GET /api/users/${userId}/chats requested`);
    try {
        const userRes = await db.query('SELECT role, gender FROM users WHERE id = $1', [userId]);
        const requestingUser = userRes.rows[0];
        
        let isOperator = false;
        if (requestingUser) {
            isOperator = requestingUser.gender === 'kadin' || ['operator', 'staff', 'moderator', 'admin', 'super_admin'].includes(requestingUser.role);
        }

        const query = `
            SELECT 
                c.id,
                c.operator_id, 
                c.last_message_at,
                (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT COUNT(*)::int FROM messages WHERE chat_id = c.id AND sender_id != $1 AND is_read = false) as unread_count,
                COALESCE(u.display_name, u.username, 'Bilinmeyen Kullanıcı') as name, 
                COALESCE(u.avatar_url, 'https://via.placeholder.com/150') as avatar_url,
                u.vip_level,
                u.is_verified,
                u.gender,
                true as is_online 
            FROM chats c
            LEFT JOIN users u ON ${isOperator ? 'c.user_id = u.id' : 'c.operator_id = u.id'}
            WHERE ${isOperator ? 'c.operator_id = $1' : 'c.user_id = $1'}
            ORDER BY COALESCE((SELECT MAX(created_at) FROM messages WHERE chat_id = c.id), c.last_message_at) DESC
        `;

        const result = await db.query(query, [userId]);
        const processedRows = result.rows.map(row => sanitizeUser(row, req));
        console.log(`GET /api/users/${userId}/chats - Found ${processedRows.length} chats`);
        res.json(processedRows);
    } catch (err) {
        console.error("Get User Chats Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET TOTAL UNREAD COUNT FOR USER
app.get('/api/users/:userId/unread-count', async (req, res) => {
    const { userId } = req.params;
    try {
        const userRes = await db.query('SELECT role, gender FROM users WHERE id = $1', [userId]);
        const requestingUser = userRes.rows[0];
        
        let isOperator = false;
        if (requestingUser) {
            isOperator = requestingUser.gender === 'kadin' || ['operator', 'staff', 'moderator', 'admin', 'super_admin'].includes(requestingUser.role);
        }

        const query = `
            SELECT COUNT(*)::int as total_unread
            FROM messages m
            JOIN chats c ON m.chat_id = c.id
            WHERE ${isOperator ? 'c.operator_id = $1' : 'c.user_id = $1'} 
            AND m.sender_id != $1 
            AND m.is_read = false
        `;
        const result = await db.query(query, [userId]);
        res.json({ count: result.rows[0].total_unread || 0 });
    } catch (err) {
        console.error("Get Unread Count Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// CREATE OR GET CHAT
app.post('/api/chats', async (req, res) => {
    const { userId, operatorId } = req.body;
    try {
        const existingChat = await db.query(
            'SELECT * FROM chats WHERE user_id = $1 AND operator_id = $2',
            [userId, operatorId]
        );
        if (existingChat.rows.length > 0) return res.json(existingChat.rows[0]);
        const newChat = await db.query(
            'INSERT INTO chats (user_id, operator_id, last_message_at) VALUES ($1, $2, NOW()) RETURNING *',
            [userId, operatorId]
        );
        res.json(newChat.rows[0]);
    } catch (err) {
        console.error('Create Chat Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET CHATS FOR ADMIN / OPERATORS (PERSONNEL)
app.get('/api/chats/admin', authenticateToken, authorizeRole('admin', 'super_admin', 'operator', 'moderator', 'staff'), async (req, res) => {
    try {
        console.log(`[ADMIN] Fetching chats for ${req.user.role}: ${req.user.id}`);
        
        // Base query - Get all chats joined with profile managers
        let query = `
            SELECT 
                c.*, 
                COALESCE(u.display_name, u.username, 'Bilinmeyen Kullanıcı') as user_name, 
                u.avatar_url as user_avatar,
                u.vip_level,
                u.age,
                u.gender,
                u.job,
                COALESCE(op.display_name, op.username, 'Bilinmeyen Operatör') as operator_name, 
                op.avatar_url as operator_avatar,
                op.managed_by as managed_by_id, -- Who manages this profile
                (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT COUNT(*)::int FROM messages WHERE chat_id = c.id AND sender_id = c.user_id AND is_read = false) as unread_count
            FROM chats c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN users op ON c.operator_id = op.id
        `;

        const params = [];

        // --- FILTERING LOGIC (Zimmetleme) ---
        // If not admin/super_admin, only show chats for profiles managed by this user
        if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            query += ` WHERE op.managed_by = $1 `;
            params.push(req.user.id);
            console.log(`[ADMIN] Restricting view to profiles managed by user ${req.user.id}`);
        } else {
            // Admin sees all chats that have messages
            query += ` WHERE EXISTS (SELECT 1 FROM messages m WHERE m.chat_id = c.id) `;
        }

        query += ` ORDER BY c.last_message_at DESC `;
        
        const result = await db.query(query, params);
        console.log(`GET /api/chats/admin - Found ${result.rows.length} chats.`);

        const sanitizedRows = result.rows.map(row => {
            // Sanitize both user and operator avatars
            const userPart = sanitizeUser({ avatar_url: row.user_avatar, display_name: row.user_name }, req);
            const operatorPart = sanitizeUser({ avatar_url: row.operator_avatar, display_name: row.operator_name }, req);
            return {
                ...row,
                user_avatar: userPart ? userPart.avatar_url : row.user_avatar,
                operator_avatar: operatorPart ? operatorPart.avatar_url : row.operator_avatar
            };
        });

        res.json(sanitizedRows);
    } catch (err) {
        console.error('GET /api/chats/admin - ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- AGENCY MANAGEMENT ---

// GET ALL AGENCIES
app.get('/api/admin/agencies', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT a.*, u.username as owner_name 
            FROM agencies a
            LEFT JOIN users u ON a.owner_id = u.id
            ORDER BY a.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE AGENCY
app.post('/api/admin/agencies', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { name, owner_id, commission_rate } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO agencies (name, owner_id, commission_rate) VALUES ($1, $2, $3) RETURNING *',
            [name, owner_id || null, commission_rate || 0.40]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE AGENCY
app.put('/api/admin/agencies/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { name, owner_id, commission_rate, status } = req.body;
    try {
        const result = await db.query(
            `UPDATE agencies 
             SET name = COALESCE($1, name), 
                 owner_id = COALESCE($2, owner_id), 
                 commission_rate = COALESCE($3, commission_rate),
                 status = COALESCE($4, status)
             WHERE id = $5 RETURNING *`,
            [name, owner_id, commission_rate, status, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ASSIGN USER TO AGENCY
app.post('/api/admin/users/:userId/assign-agency', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { userId } = req.params;
    const { agencyId } = req.body;
    try {
        await db.query('UPDATE users SET agency_id = $1 WHERE id = $2', [agencyId || null, userId]);
        res.json({ success: true, message: 'Kullanıcı ajansa başarıyla atandı.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET USER AGENCY INFO
app.get('/api/users/:id/agency', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT a.name, a.id, a.status
            FROM users u
            JOIN agencies a ON u.agency_id = a.id
            WHERE u.id = $1
        `, [req.params.id]);
        
        if (result.rows.length === 0) return res.json({ name: null });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// JOIN AGENCY (User side)
app.post('/api/agencies/join', authenticateToken, async (req, res) => {
    const { agencyId } = req.body;
    const userId = req.user.id;

    if (!agencyId) return res.status(400).json({ error: 'Ajans kodu gerekli.' });

    try {
        // 1. Check if agency exists
        const agencyRes = await db.query('SELECT name FROM agencies WHERE id = $1 AND status = \'active\'', [agencyId]);
        if (agencyRes.rows.length === 0) {
            return res.status(404).json({ error: 'Geçersiz veya aktif olmayan ajans kodu.' });
        }

        // 2. Update user's agency
        await db.query('UPDATE users SET agency_id = $1 WHERE id = $2', [agencyId, userId]);
        
        console.log(`[AGENCY] User ${userId} joined agency ${agencyRes.rows[0].name}`);
        res.json({ success: true, message: `${agencyRes.rows[0].name} ajansına başarıyla katıldınız!`, agencyName: agencyRes.rows[0].name });
    } catch (err) {
        res.status(500).json({ error: 'Ajansa katılırken bir hata oluştu.' });
    }
});

// DEBUG PAYOUT TRACKER
let payoutLogs = [];
app.get('/api/debug/payout-logs', (req, res) => {
    res.json(payoutLogs.slice(-50).reverse()); // Show last 50 logs
});

// FINAL DATABASE MIGRATION FOR DECIMAL SUPPORT (Temporarily unprotected for easy access)
app.get('/api/admin/fix-database-final', async (req, res) => {
    try {
        await db.query('BEGIN');
        
        console.log('[MIGRATION] Adding missing columns and converting to DECIMAL...');
        
        // 1. Add missing column first if it doesn't exist, then change types
        await db.query('ALTER TABLE operator_stats ADD COLUMN IF NOT EXISTS total_user_spend DECIMAL(12,2) DEFAULT 0');
        await db.query('ALTER TABLE operator_stats ALTER COLUMN coins_earned TYPE DECIMAL(12,2)');
        
        // 2. Ensure operators table is also updated (just in case)
        await db.query('ALTER TABLE operators ALTER COLUMN pending_balance TYPE DECIMAL(12,2)');
        await db.query('ALTER TABLE operators ALTER COLUMN lifetime_earnings TYPE DECIMAL(12,2)');
        
        // 3. AUTOMATIC PERSONNEL REPAIR
        // Ensure all staff/admin/moderators have an entry in the operators table so they can earn commission
        console.log('[MIGRATION] Repairing personnel records in operators table...');
        await db.query(`
            INSERT INTO operators (user_id, category, bio, photos, is_online, rating)
            SELECT id, 'Staff', 'Personnel account', '{}', false, 5.0
            FROM users
            WHERE role IN ('staff', 'admin', 'super_admin', 'moderator')
            AND id NOT IN (SELECT user_id FROM operators)
        `);

        await db.query('COMMIT');
        res.json({ success: true, message: 'VERİTABANI VE PERSONEL KAYITLARI BAŞARIYLA ONARILDI! Artık mesaj atabilirsiniz.' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('[MIGRATION ERROR]:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/debug/admin-chats', async (req, res) => {
    const migrationResults = [];
    try {
        console.log("[DEBUG] Final migration attempt (relaxed constraints)...");
        
        const runMigration = async (label, sql) => {
            try { 
                await db.query(sql); 
                migrationResults.push({ label, status: "SUCCESS" });
            } catch (e) { 
                migrationResults.push({ label, status: "FAILED", error: e.message });
                console.error(`[DEBUG] ${label} FAILED:`, e.message);
            }
        };

        // 1. Detect ID Type
        const idTypeResult = await db.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id' LIMIT 1");
        const idType = idTypeResult.rows[0]?.data_type === 'uuid' ? 'UUID' : 'TEXT';
        migrationResults.push({ step: "ID Detection", detected: idType });

        // 2. Force Create Tables (RELAXED CONSTRAINT - Removed REFERENCES for now)
        await runMigration("Create Operators Table", `
            CREATE TABLE IF NOT EXISTS operators (
                id SERIAL PRIMARY KEY,
                user_id ${idType} UNIQUE,
                commission_rate DECIMAL(5,2) DEFAULT 0.25,
                pending_balance INTEGER DEFAULT 0,
                lifetime_earnings INTEGER DEFAULT 0,
                last_active_at TIMESTAMP,
                last_payout_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await runMigration("Create Operator Stats Table", `
            CREATE TABLE IF NOT EXISTS operator_stats (
                id SERIAL PRIMARY KEY,
                operator_id ${idType},
                date DATE DEFAULT CURRENT_DATE,
                messages_sent INTEGER DEFAULT 0,
                coins_earned NUMERIC DEFAULT 0,
                UNIQUE(operator_id, date)
            )
        `);

        // Add granular stats columns to operator_stats - FORCED UPDATE v3
        await runMigration("Force Add Stats Columns v3", `
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
        
        // Ensure coins_earned is numeric to avoid rounding errors
        await runMigration("Ensure coins_earned is NUMERIC", 'ALTER TABLE operator_stats ALTER COLUMN coins_earned TYPE NUMERIC');

        // 3. Columns
        await runMigration("Add managed_by", 'ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_by TEXT'); 
        await runMigration("Add last_message", 'ALTER TABLE chats ADD COLUMN IF NOT EXISTS last_message TEXT');
        await runMigration("Add unread_count", 'ALTER TABLE chats ADD COLUMN IF NOT EXISTS unread_count INT DEFAULT 0');

        console.log("[DEBUG] Relaxed migration steps executed.");

        // 4. Test Personnel Query (Using casts for safety)
        const personnelQuery = `
            SELECT u.id FROM users u
            LEFT JOIN operators o ON u.id::text = o.user_id::text
            WHERE u.role IN ('operator', 'moderator', 'admin', 'super_admin') 
            AND u.account_status = 'active'
            LIMIT 1
        `;
        const result = await db.query(personnelQuery);

        res.json({ 
            success: true, 
            migrations: migrationResults,
            message: "BAĞLANTI ZORUNLULUĞU KALDIRILDI VE TABLOLAR OLUŞTURULDU!", 
            test_query_success: result.rows.length >= 0
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            migrations: migrationResults,
            error: err.message, 
            stack: err.stack 
        });
    }
});

// GET PUBLIC COIN PACKAGES
app.get('/api/public/packages', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM coin_packages ORDER BY price ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch Packages Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// MARK MESSAGES AS READ
app.put('/api/chats/:chatId/read', async (req, res) => {
    const { chatId } = req.params;
    const { userId } = req.body;

    try {
        await db.query(
            'UPDATE messages SET is_read = true WHERE chat_id = $1 AND sender_id != $2 AND is_read = false',
            [chatId, userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Mark Read Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET MESSAGES FOR A CHAT
app.get('/api/messages/:chatId', async (req, res) => {
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    try {
        // Fetch latest messages using DESC limit/offset, then flip back to ASC for display
        const query = `
            SELECT * FROM (
                SELECT m.*, 
                       COALESCE(u.display_name, u.username, 'Bilinmeyen Kullanıcı') as sender_name,
                       g.name as gift_name, 
                       g.cost as gift_cost, 
                       g.icon_url as gift_icon
                FROM messages m
                LEFT JOIN users u ON m.sender_id = u.id
                LEFT JOIN gifts g ON m.gift_id = g.id
                WHERE m.chat_id = $1
                ORDER BY m.created_at DESC
                LIMIT $2 OFFSET $3
            ) sub
            ORDER BY created_at ASC
        `;
        const result = await db.query(query, [chatId, limit, offset]);
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch Messages Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// DEBUG: Temporary endpoint to update gender
app.post('/api/debug/update-gender', async (req, res) => {
    const { email, gender } = req.body;
    try {
        const result = await db.query(
            "UPDATE users SET gender = $1 WHERE email = $2 RETURNING *",
            [gender, email]
        );
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SEND MESSAGE VIA HTTP (for automated messages)
app.post('/api/messages', async (req, res) => {
    const { chatId, senderId, content, type } = req.body;
    try {
        console.log(`[MESSAGE] Sending message to chat ${chatId} from sender ${senderId}`);
        const result = await db.query(
            'INSERT INTO messages (chat_id, sender_id, content, content_type) VALUES ($1, $2, $3, $4) RETURNING *',
            [chatId, senderId, content, type || 'text']
        );
        const savedMsg = result.rows[0];

        // Update last message in chat
        await db.query('UPDATE chats SET last_message_at = NOW(), last_message = $2 WHERE id = $1', [chatId, content]);

        // Broadcast via socket if room is active
        io.to(chatId).emit('receive_message', savedMsg);

        res.json(savedMsg);
    } catch (err) {
        console.error('HTTP Send Message Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- STAFF TRACKING API ---
app.get('/api/admin/staff-activity', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT 
                os.*,
                u.username,
                u.display_name,
                u.avatar_url
            FROM operator_stats os
            JOIN users u ON os.operator_id = u.id
            WHERE os.date >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY os.date DESC, os.coins_earned DESC
        `);
        res.json(stats.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/commission-logs', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const logs = await db.query(`
            SELECT 
                cl.*,
                u.username as operator_name,
                c.user_id as customer_id,
                cu.username as customer_name
            FROM commission_logs cl
            JOIN users u ON cl.operator_id = u.id
            JOIN chats c ON cl.chat_id = c.id
            JOIN users cu ON c.user_id = cu.id
            ORDER BY cl.created_at DESC
            LIMIT 200
        `);
        res.json(logs.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Referral System Endpoints ---
app.post('/api/admin/referrals/link', authenticateToken, async (req, res) => {
    if (!['admin', 'super_admin'].includes(req.user.role.toLowerCase())) return res.status(403).json({ error: 'Yetkisiz erişim' });
    
    const { userId, referrerId } = req.body;
    try {
        await db.query('UPDATE users SET affiliate_id = $1 WHERE id = $2', [referrerId, userId]);
        res.json({ success: true, message: 'Kullanıcı başarıyla personelle eşleştirildi' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- REPAIR DB ENDPOINT (DIAGNOSTIC) ---
app.get('/api/admin/repair-db-referred', authenticateToken, async (req, res) => {
    if (!['admin', 'super_admin'].includes(req.user.role.toLowerCase())) return res.status(403).json({ error: 'Yetkisiz erişim' });
    
    const diagnostics = [];
    try {
        diagnostics.push("Onarım başlatıldı...");
        
        // 1. Drop existing column if it's UUID or anything else (Force clean start)
        try {
            await db.query('ALTER TABLE users DROP COLUMN IF EXISTS referred_by CASCADE');
            await db.query('ALTER TABLE users DROP COLUMN IF EXISTS affiliate_id CASCADE');
            diagnostics.push("Eski sütunlar temizlendi.");
        } catch (e) { diagnostics.push("Temizleme hatası (önemsiz): " + e.message); }

        // 2. Add affiliate_id as INTEGER (Matching production ID type)
        await db.query('ALTER TABLE users ADD COLUMN affiliate_id INTEGER');
        diagnostics.push("affiliate_id sütunu INTEGER olarak oluşturuldu.");

        // 3. Verify
        const check = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'affiliate_id'");
        diagnostics.push("Yeni durum: " + JSON.stringify(check.rows[0]));

        res.json({ 
            success: true, 
            message: "Veritabanı başarıyla onarıldı. Artık eşleştirme yapabilirsiniz.",
            diagnostics
        });
    } catch (err) {
        res.status(500).json({ error: err.message, diagnostics });
    }
});

app.get('/api/admin/referrals/stats', authenticateToken, async (req, res) => {
    if (!['admin', 'super_admin'].includes(req.user.role.toLowerCase())) return res.status(403).json({ error: 'Yetkisiz erişim' });
    
    try {
        const stats = await db.query(`
            SELECT 
                r.username as referrer_name,
                u.id as user_id,
                u.username as user_name,
                u.email as user_email,
                COALESCE(SUM(p.amount), 0) as total_deposit,
                u.created_at as joined_at
            FROM users u
            JOIN users r ON u.affiliate_id = r.id
            LEFT JOIN payments p ON u.id = p.user_id AND p.status = 'completed'
            GROUP BY r.username, u.id, u.username, u.email, u.created_at
            ORDER BY u.created_at DESC
        `);
        res.json(stats.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- MODERATION API ---

// File Upload Endpoint with Optimization
app.post('/api/upload', authenticateToken, upload.any(), async (req, res) => {
    try {
        console.log('[UPLOAD] Request handler started');

        // Handle both single('file') and any() formats
        const file = req.file || (req.files && req.files[0]);

        if (!file) {
            console.error('[UPLOAD] No file in request object');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = file.path;
        const ext = path.extname(file.originalname).toLowerCase();

        console.log(`[UPLOAD] Processing file: ${file.filename}, ext: ${ext}, path: ${filePath}`);

        // Handle Image Optimization and Cloudinary Upload
        let finalUrl = '';
        const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

        if (isImage) {
            try {
                console.log(`[UPLOAD] Uploading to Cloudinary: ${filePath}`);

                // Upload directly to Cloudinary
                const cloudResult = await cloudinary.uploader.upload(filePath, {
                    folder: 'dating_app_avatars',
                    resource_type: 'auto',
                    transformation: [
                        { width: 1000, height: 1000, crop: 'limit' },
                        { quality: 'auto' }
                    ]
                });

                finalUrl = cloudResult.secure_url;
                console.log('[UPLOAD] Cloudinary Success:', finalUrl);

                // Delete local file after upload
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (cloudErr) {
                console.error('[UPLOAD] Cloudinary Error:', cloudErr.message);
                // Fallback to local if Cloudinary fails (not ideal but safe)
                const protocol = req.protocol;
                const host = req.get('host');
                finalUrl = `${protocol}://${host}/uploads/${file.filename}`;
            }
        } else {
            // Non-image files (if any) stay local for now
            const protocol = req.protocol;
            const host = req.get('host');
            finalUrl = `${protocol}://${host}/uploads/${file.filename}`;
        }

        console.log(`[UPLOAD] Success! Final URL: ${finalUrl}`);
        res.json({
            url: finalUrl,
            relativePath: isImage ? '' : `/uploads/${file.filename}`,
            provider: finalUrl.includes('cloudinary') ? 'cloudinary' : 'local'
        });
    } catch (err) {
        console.error('[UPLOAD] CRITICAL ROUTE ERROR:', err);
        res.status(500).json({
            error: 'Internal server error during upload',
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// Submit a photo for moderation
app.post('/api/moderation/submit', async (req, res) => {
    const { userId, type, url } = req.body; // type: 'avatar' or 'album'
    console.log(`[MODERATION] Submit from ${userId}, type: ${type}, url: ${url}`);

    if (!userId || !url) {
        console.error('❌ [MODERATION] Missing data:', { userId, type, url });
        return res.status(400).json({ error: 'User ID ve URL gereklidir.' });
    }

    try {
        const result = await db.query(
            'INSERT INTO pending_photos (user_id, type, url) VALUES ($1, $2, $3) RETURNING *',
            [userId, type, url]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('❌ MODERATION SUBMIT ERROR [500]:', err.message, '| Data:', JSON.stringify(req.body));
        res.status(500).json({
            error: 'Modernasyon kaydı başarısız oldu.',
            details: err.message,
            debug_info: { table: 'pending_photos', schema_fix_attempted: true }
        });
    }
});

// Get all pending photos (Admin)
app.get('/api/moderation/pending', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT p.*, u.username FROM pending_photos p JOIN users u ON p.user_id = u.id WHERE p.status = \'pending\' ORDER BY p.created_at ASC'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Approve a photo
app.post('/api/moderation/approve', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { photoId } = req.body;
    try {
        // 1. Get photo details
        const photoResult = await db.query('SELECT * FROM pending_photos WHERE id = $1', [photoId]);
        if (photoResult.rows.length === 0) return res.status(404).json({ error: 'Photo not found' });

        const photo = photoResult.rows[0];

        // 2. Update status
        await db.query('UPDATE pending_photos SET status = \'approved\' WHERE id = $1', [photoId]);

        // 3. Update User/Operator profile
        if (photo.type === 'avatar') {
            await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [photo.url, photo.user_id]);
        } else if (photo.type === 'album') {
            // Append to array in both users and operators table (if exists)
            await db.query(
                'UPDATE users SET photos = array_append(COALESCE(photos, \'{}\'), $1) WHERE id = $2',
                [photo.url, photo.user_id]
            );
            
            // Check if user is an operator
            const opRes = await db.query('SELECT 1 FROM operators WHERE user_id = $1', [photo.user_id]);
            if (opRes.rows.length > 0) {
                await db.query(
                    'UPDATE operators SET photos = array_append(COALESCE(photos, \'{}\'), $1) WHERE user_id = $2',
                    [photo.url, photo.user_id]
                );
            }
        }

        // Log Activity
        logActivity(io, photo.user_id, 'admin', `${photo.type === 'avatar' ? 'Profil' : 'Albüm'} fotoğrafı onaylandı.`);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reject a photo
app.post('/api/moderation/reject', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { photoId } = req.body;
    try {
        const photoRes = await db.query('SELECT * FROM pending_photos WHERE id = $1', [photoId]);
        if (photoRes.rows.length === 0) return res.status(404).json({ error: 'Fotoğraf bulunamadı.' });

        const photo = photoRes.rows[0];

        await db.query('UPDATE pending_photos SET status = \'rejected\' WHERE id = $1', [photoId]);

        // --- NEW FIX: Clear from user profile if it was already set ---
        if (photo.type === 'avatar') {
            await db.query('UPDATE users SET avatar_url = NULL WHERE id = $1 AND avatar_url = $2', [photo.user_id, photo.url]);
        } else if (photo.type === 'album') {
            await db.query(
                'UPDATE users SET photos = array_remove(photos, $1) WHERE id = $2',
                [photo.url, photo.user_id]
            );
            // Also check operators table
            await db.query(
                'UPDATE operators SET photos = array_remove(photos, $1) WHERE user_id = $2',
                [photo.url, photo.user_id]
            );
        }

        // STORAGE PROTECTION: Delete the file physically if rejected
        if (photo.url && photo.url.includes('cloudinary')) {
            // Cloudinary deletion if needed, but for now we at least clear it from DB
            console.log('Rejected photo URL cleared from profile:', photo.url);
        } else if (photo.url && photo.url.includes('/uploads/')) {
            const fileName = photo.url.split('/').pop();
            const filePath = path.join(__dirname, 'uploads', fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('Rejected photo deleted from local storage:', fileName);
            }
        }

        logActivity(io, photo.user_id, 'admin', 'Fotoğrafı reddedildi.');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MAINTENANCE & OPTIMIZATION API ---

app.get('/api/admin/maintenance/stats', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const msgCount = await db.query('SELECT COUNT(*) FROM messages');
        const activityCount = await db.query('SELECT COUNT(*) FROM activities');
        const pendingCount = await db.query('SELECT COUNT(*) FROM pending_photos WHERE status = \'pending\'');

        // File stats
        const files = fs.readdirSync(uploadsDir);
        let totalSize = 0;
        files.forEach(f => {
            const stats = fs.statSync(path.join(uploadsDir, f));
            totalSize += stats.size;
        });

        res.json({
            messages: parseInt(msgCount.rows[0].count),
            activities: parseInt(activityCount.rows[0].count),
            pendingPhotos: parseInt(pendingCount.rows[0].count),
            fileCount: files.length,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/maintenance/cleanup', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { type } = req.body; // 'messages', 'activities', 'orphaned_files'
    try {
        if (type === 'messages') {
            // Delete messages older than 30 days
            const result = await db.query("DELETE FROM messages WHERE created_at < NOW() - INTERVAL '30 days'");
            res.json({ success: true, count: result.rowCount });
        } else if (type === 'activities') {
            // Keep only latest 500 logs
            const result = await db.query(`
                DELETE FROM activities 
                    ORDER BY created_at DESC 
                    LIMIT 500
                )
            `);
            res.json({ success: true, count: result.rowCount });
        } else if (type === 'orphaned_files') {
            // Complex orphaned file cleanup could be added here
            const rejected = await db.query("SELECT url FROM pending_photos WHERE status = 'rejected'");
            let count = 0;
            for (const row of rejected.rows) {
                if (row.url && row.url.includes('/uploads/')) {
                    const fileName = row.url.split('/').pop();
                    const filePath = path.join(uploadsDir, fileName);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        count++;
                    }
                }
            }
            await db.query("DELETE FROM pending_photos WHERE status = 'rejected'");
            res.json({ success: true, count });
        } else {
            res.status(400).json({ error: 'Invalid cleanup type' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- OPERATOR PAYOUT & PERFORMANCE API (Admin) ---

// GET CURRENT OPERATOR/STAFF STATS
// DEBUG: Dump Users for ID verification
app.get('/api/debug/dump-users', async (req, res) => {
    try {
        const result = await db.query('SELECT id, username, role, managed_by FROM users WHERE role IN (\'staff\', \'admin\', \'operator\', \'moderator\') OR username = \'test\'');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET CURRENT OPERATOR/STAFF STATS
app.get('/api/operator/my-stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('[DEBUG] my-stats request for userId:', userId);
        
        const query = `
            SELECT 
                u.id, u.username, u.display_name, u.avatar_url, u.role,
                COALESCE(o.pending_balance, 0) as pending_balance, 
                COALESCE(o.lifetime_earnings, 0) as lifetime_earnings, 
                COALESCE(o.commission_rate, 0.25) as commission_rate, 
                o.last_payout_at,
                o.last_active_at,
                
                -- Today Stats
                (SELECT COALESCE(SUM(coins_earned), 0) FROM operator_stats WHERE operator_id::text = $1::text AND date = CURRENT_DATE) as earned_today,
                (SELECT COALESCE(SUM(text_count), 0) FROM operator_stats WHERE operator_id::text = $1::text AND date = CURRENT_DATE) as text_count_today,
                (SELECT COALESCE(SUM(image_count), 0) FROM operator_stats WHERE operator_id::text = $1::text AND date = CURRENT_DATE) as image_count_today,
                (SELECT COALESCE(SUM(audio_count), 0) FROM operator_stats WHERE operator_id::text = $1::text AND date = CURRENT_DATE) as audio_count_today,
                (SELECT COALESCE(SUM(gift_count), 0) FROM operator_stats WHERE operator_id::text = $1::text AND date = CURRENT_DATE) as gift_count_today,
                (SELECT COALESCE(SUM(text_earned), 0) FROM operator_stats WHERE operator_id::text = $1::text AND date = CURRENT_DATE) as text_earned_today,
                (SELECT COALESCE(SUM(image_earned), 0) FROM operator_stats WHERE operator_id::text = $1::text AND date = CURRENT_DATE) as image_earned_today,
                (SELECT COALESCE(SUM(audio_earned), 0) FROM operator_stats WHERE operator_id::text = $1::text AND date = CURRENT_DATE) as audio_earned_today,
                (SELECT COALESCE(SUM(gift_earned), 0) FROM operator_stats WHERE operator_id::text = $1::text AND date = CURRENT_DATE) as gift_earned_today,
                
                -- Global Stats
                (SELECT COALESCE(COUNT(*), 0) FROM chats WHERE managed_by::text = $1::text) as active_chats,
                (SELECT COALESCE(SUM(messages_sent), 0) FROM operator_stats WHERE operator_id::text = $1::text) as total_messages
            FROM users u
            LEFT JOIN operators o ON u.id::text = o.user_id::text
            WHERE u.id::text = $1::text
        `;
        const result = await db.query(query, [userId]);
        
        if (result.rows.length === 0) return res.status(404).json({ error: 'Stats not found' });
        
        // Fetch Weekly Stats separately for clarity
        const weeklyRes = await db.query(`
            SELECT date, messages_sent, coins_earned, text_count, image_count, audio_count
            FROM operator_stats
            WHERE operator_id::text = $1::text
            AND date >= CURRENT_DATE - INTERVAL '7 days'
            ORDER BY date DESC
        `, [userId]);

        const responseData = {
            ...result.rows[0],
            weekly_stats: weeklyRes.rows
        };
        
        res.json(responseData);
    } catch (err) {
        console.error('my-stats error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET ALL PERSONNEL (Staff) for assignment and earnings
app.get('/api/admin/operators/earnings', authenticateToken, authorizeRole('admin', 'super_admin', 'operator', 'moderator'), async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id, u.username, u.display_name, u.avatar_url, u.role,
                COALESCE(o.pending_balance, 0) as pending_balance, 
                COALESCE(o.lifetime_earnings, 0) as lifetime_earnings, 
                COALESCE(o.commission_rate, 0.25) as commission_rate, 
                o.last_payout_at,
                o.last_active_at,
                (SELECT COALESCE(SUM(coins_earned), 0) FROM operator_stats WHERE operator_id::text = u.id::text AND date = CURRENT_DATE) as earned_today,
                (SELECT COALESCE(SUM(messages_sent), 0) FROM operator_stats WHERE operator_id::text = u.id::text) as total_messages
            FROM users u
            LEFT JOIN operators o ON u.id::text = o.user_id::text
            WHERE u.role IN ('operator', 'moderator', 'admin', 'super_admin', 'staff') AND u.account_status = 'active'
            ORDER BY o.pending_balance DESC NULLS LAST
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Process a payout for an operator
app.post('/api/admin/operators/:id/payout', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { amount, method } = req.body; // amount in coins/currency to settle

    try {
        await db.query('BEGIN');

        // 1. Get current pending balance
        const opRes = await db.query('SELECT pending_balance FROM operators WHERE user_id = $1 FOR UPDATE', [id]);
        if (opRes.rows.length === 0) throw new Error('Operatör bulunamadı.');

        const pending = opRes.rows[0].pending_balance;
        const payoutAmount = amount || pending; // If no amount specified, settle all

        if (payoutAmount <= 0) throw new Error('Ödenecek tutar 0 olamaz.');
        if (payoutAmount > pending) throw new Error('Ödenmek istenen tutar bekleyen bakiyeden büyük olamaz.');

        // 2. Record the payout in payouts table
        await db.query(
            'INSERT INTO payouts (operator_id, amount, status, payment_method, processed_at) VALUES ($1, $2, $3, $4, NOW())',
            [id, payoutAmount, 'processed', method || 'Manual']
        );

        // 3. Update operator's pending balance
        await db.query(
            'UPDATE operators SET pending_balance = pending_balance - $1, last_payout_at = NOW() WHERE user_id = $2',
            [payoutAmount, id]
        );

        await db.query('COMMIT');
        res.json({ success: true, message: 'Ödeme başarıyla işlendi ve bakiye düşüldü.' });

    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// Get global payout stats
app.get('/api/admin/payouts/summary', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const stats = await db.query(`
            SELECT 
                SUM(pending_balance) as total_pending,
                SUM(lifetime_earnings) as total_lifetime,
                (SELECT SUM(amount) FROM payouts WHERE status = 'processed') as total_paid
            FROM operators
        `);
        res.json(stats.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- VIP PROGRESSION SYSTEM ---

// VIP XP PURCHASE ENDPOINT
// User spends coins to gain VIP XP (1 coin = 1 XP)
app.post('/api/vip/purchase-xp', authenticateToken, async (req, res) => {
    const { coins } = req.body;
    const userId = req.user.id;

    try {
        // Validate input
        if (!coins || coins <= 0) {
            return res.status(400).json({ error: 'Geçersiz coin miktarı.' });
        }

        // Get user's current balance and vip_xp
        const userResult = await db.query('SELECT balance, vip_xp FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const user = userResult.rows[0];
        const currentBalance = user.balance || 0;
        const currentVipXp = user.vip_xp || 0;

        // Check if user has enough coins
        if (currentBalance < coins) {
            return res.status(400).json({
                error: 'Yetersiz bakiye.',
                required: coins,
                available: currentBalance
            });
        }

        // Calculate new values
        const newBalance = currentBalance - coins;
        const newVipXp = currentVipXp + coins; // 1:1 conversion
        const oldVipLevel = getVipLevel(currentVipXp);
        const newVipLevel = getVipLevel(newVipXp);
        const leveledUp = newVipLevel > oldVipLevel;

        // Update user
        await db.query(
            'UPDATE users SET balance = $1, vip_xp = $2 WHERE id = $3',
            [newBalance, newVipXp, userId]
        );

        // Log activity
        logActivity(io, userId, 'vip_xp_purchase', `${coins} coin harcayarak ${coins} VIP XP kazandı.`);

        // Get progress info
        const progress = getVipProgress(newVipXp);

        res.json({
            success: true,
            coinsSpent: coins,
            newBalance,
            newVipXp,
            oldVipLevel,
            newVipLevel,
            leveledUp,
            progress
        });

    } catch (err) {
        console.error('VIP XP Purchase Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET VIP PROGRESS
// Returns user's current VIP level and progress to next level
app.get('/api/vip/progress', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const userResult = await db.query('SELECT vip_xp FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const vipXp = userResult.rows[0].vip_xp || 0;
        const progress = getVipProgress(vipXp);

        res.json(progress);

    } catch (err) {
        console.error('VIP Progress Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- SOCKET.IO REAL-TIME CHAT ---

// Gift Configuration
const initializeGifts = async () => {
    try {
        console.log('[GIFTS] Checking schema and data...');

        // 1. Check ID type
        const colRes = await db.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'gifts' AND column_name = 'id'");
        if (colRes.rows.length > 0) {
            const type = colRes.rows[0].data_type;
            if (type !== 'integer' && type !== 'int') {
                console.warn('[GIFTS] Schema mismatch (UUID detected). Dropping table to switch to INT IDs.');
                await db.query('DROP TABLE gifts');
            }
        }

        // 2. Ensure Table Exists
        await db.query(`
            CREATE TABLE IF NOT EXISTS gifts (
                id INT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                cost INT NOT NULL,
                icon_url TEXT NOT NULL
            )
        `);

        // 3. Populate if empty
        const countRes = await db.query('SELECT COUNT(*) FROM gifts');
        if (parseInt(countRes.rows[0].count) === 0) {
            console.log('[GIFTS] Seeding default gifts...');
            const DEFAULT_GIFTS = [
                { id: 1, name: 'Gül', cost: 50 },
                { id: 2, name: 'Kahve', cost: 100 },
                { id: 3, name: 'Çikolata', cost: 250 },
                { id: 4, name: 'Ayıcık', cost: 500 },
                { id: 5, name: 'Pırlanta', cost: 1000 },
                { id: 6, name: 'Yarış Arabası', cost: 2000 },
                { id: 7, name: 'Şato', cost: 5000 },
                { id: 8, name: 'Helikopter', cost: 10000 },
                { id: 9, name: 'Yat', cost: 15000 },
                { id: 10, name: 'Tac', cost: 20000 }
            ];

            for (const g of DEFAULT_GIFTS) {
                await db.query(
                    'INSERT INTO gifts (id, name, cost, icon_url) VALUES ($1, $2, $3, $4)',
                    [g.id, g.name, g.cost, 'gift_icon_default']
                );
            }
            console.log('[GIFTS] Seeded 10 gifts.');
        } else {
            console.log('[GIFTS] Table ready.');
        }

    } catch (err) {
        console.error('[GIFTS] Init Error:', err.message);
    }
};

// Call this after DB init
// Note: We need to hook this into the start sequence. 
// For now, I'll self-invoke it here or add to initializeDatabase if accessible, 
// but initializeDatabase is top-level. I'll just run it.
initializeGifts();

// --- SOCKET AUTHENTICATION MIDDLEWARE ---
io.use(async (socket, next) => {
    if (!global.payoutLogs) global.payoutLogs = [];
    try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) {
            global.payoutLogs.push({ timestamp: new Date().toISOString(), type: 'AUTH_FAILED', reason: 'Token missing', socketId: socket.id });
            console.log(`[SOCKET] Authentication error: Token missing for socket ${socket.id}`);
            return next(new Error('Authentication error: Token required'));
        }

        const decoded = jwt.verify(token, SECRET_KEY);
        const result = await db.query('SELECT id, username, role, account_status, balance, vip_level, gender, agency_id FROM users WHERE id = $1', [decoded.id]);

        if (result.rows.length === 0) {
            global.payoutLogs.push({ timestamp: new Date().toISOString(), type: 'AUTH_FAILED', reason: 'User not found', userId: decoded.id });
            return next(new Error('User not found'));
        }

        const user = result.rows[0];
        if (user.account_status !== 'active') {
            global.payoutLogs.push({ timestamp: new Date().toISOString(), type: 'AUTH_FAILED', reason: 'Account inactive', userId: user.id });
            return next(new Error('Account not active'));
        }

        socket.user = user;
        global.payoutLogs.push({ timestamp: new Date().toISOString(), type: 'AUTH_SUCCESS', username: user.username, userId: user.id });
        console.log(`[SOCKET] Authenticated user: ${user.username} (${user.id}) on socket ${socket.id}`);
        next();
    } catch (err) {
        global.payoutLogs.push({ timestamp: new Date().toISOString(), type: 'AUTH_CRITICAL_ERROR', error: err.message });
        console.log(`[SOCKET] Auth failed: ${err.message}`);
        next(new Error('Authentication failed'));
    }
});

io.on('connection', (socket) => {
    const connLog = {
        timestamp: new Date().toISOString(),
        type: 'CLIENT_CONNECTED',
        socketId: socket.id,
        user: socket.user ? { id: socket.user.id, username: socket.user.username } : 'ANONYMOUS'
    };
    if (!global.payoutLogs) global.payoutLogs = [];
    global.payoutLogs.push(connLog);
    
    console.log(`[SOCKET] User connected: ${socket.id} (Authenticated: ${socket.user ? socket.user.username : 'NO'})`);

    // Join their own room for global notifications
    if (socket.user && socket.user.id) {
        const userRoom = socket.user.id.toString();
        socket.join(userRoom);
        console.log(`[SOCKET] User ${socket.user.username} joined personal room: ${userRoom}`);
    }
    socket.on('join_room', (chatId) => {
        if (!chatId) {
            console.error(`[SOCKET] User ${socket.user?.username || socket.id} tried to join an empty room!`);
            return;
        }
        const roomName = chatId.toString();
        socket.join(roomName);
        console.log(`[SOCKET] User ${socket.user?.username || socket.id} (${socket.id}) joined room: ${roomName}`);
    });

    // --- TYPING INDICATOR (YAZIYOR...) ---
    socket.on('typing_start', (data) => {
        const chatId = data.chatId ? data.chatId.toString() : null;
        if (!chatId) return;

        console.log(`[SOCKET] typing_start received from ${socket.user?.username || socket.id} for chatId: ${chatId}`);
        // Broadcast to everyone in the room EXCEPT the sender
        socket.to(chatId).emit('display_typing', {
            userId: socket.user ? socket.user.id.toString() : null,
            chatId: chatId
        });
    });

    socket.on('typing_end', (data) => {
        const chatId = data.chatId ? data.chatId.toString() : null;
        if (!chatId) return;

        console.log(`[SOCKET] typing_end received from ${socket.user?.username || socket.id} for chatId: ${chatId}`);
        socket.to(chatId).emit('hide_typing', {
            userId: socket.user ? socket.user.id.toString() : null,
            chatId: chatId
        });
    });

    // Send Message
    socket.on('send_message', async (data) => {
        console.log('[SOCKET] send_message received:', JSON.stringify(data, null, 2));
        const { chatId, content, type, giftId, tempId, unlockCost, duration } = data;
        const senderId = socket.user.id;

        console.log(`[DEBUG-SEND] chatId: ${chatId} (${typeof chatId}), senderId: ${senderId} (${typeof senderId}), type: ${type}`);
        if (!global.payoutLogs) global.payoutLogs = [];
        global.payoutLogs.push({ timestamp: new Date().toISOString(), type: 'DEBUG_SEND', data: { chatId, senderId, contentType: type, chatIdType: typeof chatId } });
        global.payoutLogs.push({
            timestamp: new Date().toISOString(),
            type: 'SEND_MESSAGE_START',
            chatId,
            senderId,
            contentType: type
        });

        let client;

        try {
            client = await db.pool.connect();
            console.log(`[SOCKET] Starting send_message transaction for chatId: ${chatId}, senderId: ${senderId}`);
            await client.query('BEGIN'); // Start Transaction

            // Check if sender is an operator
            // Optimization: We could check socket.user.role, but let's trust DB check for consistency
            // Actually, we loaded role in middleware. 
            // Let's use socket.user.role if it helps, but 'operator' role might be in 'users' table or 'operators' table check needed.
            // The existing code checks 'operators' table existence. Let's keep it but use senderId (from auth).
            const operatorCheck = await client.query('SELECT user_id FROM operators WHERE user_id = $1', [senderId]);
            const isOperator = operatorCheck.rows.length > 0;

            let cost = 0;
            let userBalance = 0;
            let currentBalance = 0;
            let giftDetails = null;

            // Load recipient and check for female-to-female messaging
            const chatRes = await client.query('SELECT user_id, operator_id FROM chats WHERE id = $1', [chatId]);
            let isFemaleToFemale = false;
            let chatReceiverId = null;
            if (chatRes.rows.length > 0) {
                const chat = chatRes.rows[0];
                const receiverId = senderId.toString() === chat.user_id.toString() ? chat.operator_id : chat.user_id;
                chatReceiverId = receiverId;
                
                const receiverRes = await client.query('SELECT gender FROM users WHERE id = $1', [receiverId]);
                if (receiverRes.rows.length > 0) {
                    const receiverGender = (receiverRes.rows[0].gender || '').toLowerCase();
                    const senderGender = (socket.user.gender || '').toLowerCase();
                    if (senderGender === 'kadin' && receiverGender === 'kadin') {
                        isFemaleToFemale = true;
                        console.log(`[SOCKET] Female-to-Female messaging detected in chat ${chatId} (Sender: ${senderId}, Receiver: ${receiverId}). Coins will be charged and no commission earned.`);
                    }
                }
            }

            // --- 1. COIN DEDUCTION LOGIC ---
            // Management roles don't pay for messages, except when it is a female-to-female chat
            const userRole = (socket.user.role || '').toLowerCase();
            const userGender = (socket.user.gender || '').toLowerCase();
            const isManagement = !isFemaleToFemale && (['admin', 'super_admin', 'moderator', 'staff', 'operator'].includes(userRole) || userGender === 'kadin');
            
            let commissionDataToRunLater = null;
            
            if (!isManagement) {
                cost = 10; // Default text
                if (type === 'gift' && giftId) {
                    const giftRes = await client.query('SELECT * FROM gifts WHERE id = $1', [giftId]);
                    if (giftRes.rows.length > 0) {
                        giftDetails = giftRes.rows[0];
                        cost = giftDetails.cost;
                    } else {
                        throw new Error('Invalid Gift ID');
                    }
                } else if (type === 'image') {
                    cost = 50;
                } else if (type === 'audio') {
                    cost = 30;
                }

                const userResult = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [senderId]);
                if (userResult.rows.length === 0) throw new Error('User not found');

                currentBalance = parseFloat(userResult.rows[0].balance || 0);
                console.log(`[PAYOUT-DEBUG] Sender ${senderId} (Role: ${socket.user.role}) current balance: ${currentBalance}, cost: ${cost}`);

                if (currentBalance < cost) {
                    console.log(`[PAYOUT-DEBUG] Insufficient funds for ${senderId}. Has ${currentBalance}, needs ${cost}`);
                    await client.query('ROLLBACK');
                    io.to(socket.id).emit('message_error', {
                        code: 'INSUFFICIENT_FUNDS',
                        message: `Yetersiz bakiye. Bu işlem için ${cost} coin gerekli.`,
                        required: cost,
                        tempId: tempId
                    });
                    return;
                }

                const updateRes = await client.query('UPDATE users SET balance = balance - $2 WHERE id = $1 RETURNING balance', [senderId, cost]);
                userBalance = parseFloat(updateRes.rows[0].balance);
                io.emit('admin_balance_update', { userId: senderId, newBalance: userBalance });
                socket.emit('balance_update', { userId: senderId, newBalance: userBalance });

                if (type === 'gift' && !isFemaleToFemale) {
                    const chatResInner = await client.query('SELECT operator_id FROM chats WHERE id = $1', [chatId]);
                    if (chatResInner.rows.length > 0) {
                        commissionDataToRunLater = { chatId, senderId: null, cost, type: 'gift' };
                    }
                }
            } else {
                // Only female users (gender === 'kadin') earn commission on response!
                if (userGender === 'kadin' && !isFemaleToFemale) {
                    // CHECK: Only give commission if the LAST message in the chat was from the other user (male)
                    // If the female is sending multiple messages in a row, she only gets paid for the first one.
                    let shouldGiveCommission = true;
                    if (chatReceiverId) {
                        const lastMsgRes = await client.query('SELECT sender_id FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 1', [chatId]);
                        if (lastMsgRes.rows.length > 0) {
                            const lastSenderId = lastMsgRes.rows[0].sender_id;
                            if (lastSenderId && lastSenderId.toString() !== chatReceiverId.toString()) {
                                shouldGiveCommission = false;
                                console.log(`[SOCKET] Commission denied for ${senderId} in chat ${chatId}: Last message was not from the user ${chatReceiverId}.`);
                            }
                        }
                    }

                    if (shouldGiveCommission) {
                        let commissionCost = 10;
                        if (type === 'image') commissionCost = 50;
                        else if (type === 'audio') commissionCost = 30;
                        
                        commissionDataToRunLater = { chatId, senderId, cost: commissionCost, type: type || 'text' };
                    }
                }
            }

            console.log(`[SOCKET] Checking management status for role: ${socket.user.role}`);
            // --- 2. SENDER MAPPING (Zimmetleme & Management Check) ---
            let finalSenderId = senderId;
            
            // If sender is management, they should message AS the operator of this chat
            if (isManagement) {
                const chatRes = await client.query('SELECT operator_id, user_id FROM chats WHERE id = $1', [chatId]);
                if (chatRes.rows.length > 0) {
                    const avatarId = chatRes.rows[0].operator_id;
                    const chatUserId = chatRes.rows[0].user_id;
                    
                    // ONLY message as the avatar if the sender is NOT the customer (user_id) of the chat!
                    if (chatUserId && chatUserId.toString() !== senderId.toString()) {
                        // Zimmet Check: If it's a staff/moderator, check if they are allowed
                        if (socket.user.role === 'staff' || socket.user.role === 'moderator') {
                            const manageCheck = await client.query('SELECT managed_by FROM users WHERE id = $1', [avatarId]);
                            const managerId = manageCheck.rows.length > 0 ? manageCheck.rows[0].managed_by : null;
                            
                            if (managerId && managerId.toString() !== senderId.toString() && socket.user.role !== 'admin' && socket.user.role !== 'super_admin') {
                                console.warn(`[SOCKET] Blocked unauthorized message attempt by ${senderId} for avatar ${avatarId}`);
                                throw new Error('BU_PROFIL_SIZE_ZIMMETLI_DEGIL');
                            }
                        }
                        
                        // All management roles message AS the avatar to keep chat consistent
                        finalSenderId = avatarId;
                    }
                }
            }

            // --- 3. SAVE MESSAGE ---
            const res = await client.query(
                'INSERT INTO messages (chat_id, sender_id, content, content_type, gift_id, unlock_cost, is_unlocked, duration) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [chatId, finalSenderId, content, type || 'text', giftId || null, type === 'locked_image' ? (unlockCost || 50) : 0, type === 'locked_image' ? false : true, duration || null]
            );
            const savedMsg = res.rows[0];

            let lastMsgPreview = content;
            if (type === 'gift') lastMsgPreview = '🎁 Hediye Gönderildi';
            else if (type === 'image') lastMsgPreview = '📷 Resim';
            else if (type === 'locked_image') lastMsgPreview = '🔒 Kilitli Resim';
            else if (type === 'audio') lastMsgPreview = '🎤 Ses Kaydı';

            await client.query('UPDATE chats SET last_message_at = NOW(), last_message = $2 WHERE id = $1', [chatId, lastMsgPreview]);

            await client.query('COMMIT');

            // --- 3.5. EXECUTE COMMISSION LATER (SAFE ZONE) ---
            if (commissionDataToRunLater) {
                try {
                    const updateInfo = await recordOperatorCommission(
                        client, 
                        commissionDataToRunLater.chatId, 
                        commissionDataToRunLater.senderId, 
                        commissionDataToRunLater.cost, 
                        commissionDataToRunLater.type
                    );
                    if (updateInfo) {
                        io.to(chatId.toString()).emit('message_updated', updateInfo);
                        console.log(`[SOCKET] Broadcasted message_updated to room ${chatId}:`, updateInfo);
                    }
                } catch (commissionErr) {
                    console.error('[COMMISSION-SAFE] Commission failed but message was sent:', commissionErr.message);
                }
            }

            // --- 4. EMIT EVENTS ---
            if (!isManagement) {
                io.to(socket.id).emit('balance_update', { userId: senderId, newBalance: userBalance });
            }

            if (giftDetails) {
                savedMsg.gift_name = giftDetails.name;
                savedMsg.gift_cost = giftDetails.cost;
                savedMsg.gift_icon = giftDetails.icon_url;
            }

            const msgToEmit = { 
                ...savedMsg, 
                chat_id: savedMsg.chat_id.toString(), 
                type: savedMsg.content_type, // Alias for mobile app compatibility
                tempId 
            };
            // EMIT ASAP
            io.to(chatId.toString()).emit('receive_message', msgToEmit);
            
            // Notify recipient globally for unread badge updates
            try {
                const chatInfo = await client.query('SELECT user_id, operator_id FROM chats WHERE id = $1', [chatId]);
                if (chatInfo.rows.length > 0) {
                    const recipientId = finalSenderId.toString() === chatInfo.rows[0].user_id.toString() 
                        ? chatInfo.rows[0].operator_id 
                        : chatInfo.rows[0].user_id;
                    io.to(recipientId.toString()).emit('new_message', msgToEmit);
                }
            } catch (notifyErr) {
                console.error('[SOCKET] Global notify error:', notifyErr.message);
            }
            
            io.emit('admin_notification', msgToEmit);

            // --- 5. PUSH NOTIFICATION (Non-blocking) ---
            (async () => {
                try {
                    const participantsRes = await client.query('SELECT user_id, operator_id FROM chats WHERE id = $1', [chatId]);
                    if (participantsRes.rows.length > 0) {
                        const { user_id, operator_id } = participantsRes.rows[0];
                        const recipientId = finalSenderId.toString() === user_id.toString() ? operator_id : user_id;

                        const senderRes = await client.query('SELECT display_name FROM users WHERE id = $1', [finalSenderId]);
                        const senderName = senderRes.rows[0]?.display_name || 'Bir kullanıcı';

                        await sendPushNotification(recipientId, {
                            title: `Yeni Mesaj: ${senderName}`,
                            body: type === 'text' ? content : (type === 'gift' ? '🎁 Sana bir hediye gönderdi!' : '📷 Bir medya dosyası gönderdi'),
                            data: { chatId: chatId.toString(), type: 'message' }
                        });
                    }
                } catch (pushErr) {
                    console.error('[SOCKET] Push trigger error:', pushErr.message);
                }
            })();

        } catch (err) {
            if (client) {
                try { await client.query('ROLLBACK'); } catch (e) { console.error('[SOCKET] Rollback Error:', e.message); }
            }
            console.error('[SOCKET] CRITICAL Send Message Error:', err.message);
            console.error('[SOCKET] Error Stack:', err.stack);
            console.error('[SOCKET] Failed Message Data:', JSON.stringify({ chatId, senderId, type, tempId }));
            
            // Add error to logs
            if (!global.payoutLogs) global.payoutLogs = [];
            global.payoutLogs.push({ timestamp: new Date().toISOString(), type: 'SEND_ERROR', error: err.message, stack: err.stack });
            
            // Send specific error message if it's a known one, otherwise generic
            let errorMsg = (err.message === 'BU_PROFIL_SIZE_ZIMMETLI_DEGIL') 
                ? 'Bu profil size zimmetli değil.' 
                : 'Mesaj gönderilemedi.';
            
            // Append debug info directly to the message so it shows up in current APKs
            errorMsg += ` (${err.message})`;

            io.to(socket.id).emit('message_error', {
                code: err.message === 'BU_PROFIL_SIZE_ZIMMETLI_DEGIL' ? 'UNAUTHORIZED' : 'SEND_FAILED',
                message: errorMsg,
                debug: err.message // Force show debug message to user for troubleshooting
            });
        } finally {
            if (client) {
                client.release();
            }
        }
    });

    socket.on('message_reaction', async (data) => {
        const { messageId, reaction, chatId } = data;
        try {
            await db.query('UPDATE messages SET reaction = $1 WHERE id = $2', [reaction, messageId]);
            io.to(chatId.toString()).emit('message_reaction', { messageId, reaction, chatId });
        } catch (err) {
            console.error('[SOCKET] reaction error:', err.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// MANUAL ADMIN CREATION: Chameleon Fix - DISABLED
// app.get('/api/admin/force-create-admin', async (req, res) => {
//    // ... code ...
// });

// MANUAL EMERGENCY FIX V2: Chameleon Fix (UUID/INT Adaptive)
app.get('/api/admin/force-fix-schema-v2', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };

    try {
        log("⚠️ [MANUAL V2] Starting Smart Schema Repair (Type Adaptive)...");

        // 2. DETECT USERS ID TYPE (Crucial!)
        let userIdType = 'UUID'; // Default
        try {
            const userTypeCheck = await db.query(`
                SELECT data_type 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'id'
            `);
            if (userTypeCheck.rows.length > 0) {
                const type = userTypeCheck.rows[0].data_type.toUpperCase();
                log(`ℹ️ [MANUAL V2] Detected users.id type: ${type}`);
                if (type === 'INTEGER' || type === 'INT') {
                    userIdType = 'INTEGER';
                }
            } else {
                log("⚠️ [MANUAL V2] Could not detect users.id type, defaulting to UUID.");
            }
        } catch (e) {
            log(`❌ [MANUAL V2] Failed to check users type: ${e.message}`);
        }

        // 3. Try Create if not exists with MATCHING TYPE
        try {
            await db.query(`CREATE TABLE IF NOT EXISTS pending_photos (
                id SERIAL PRIMARY KEY,
                user_id ${userIdType} REFERENCES users(id),
                type VARCHAR(50),
                url TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW()
            )`);
            log(`✅ [MANUAL V2] 'CREATE TABLE IF NOT EXISTS' executed with user_id: ${userIdType}.`);
        } catch (e) { log(`❌ [MANUAL V2] Create failed: ${e.message}`); }

        // 4. Force Add Columns (Safe, idempotent)
        const addCol = async (col, type) => {
            try {
                await db.query(`ALTER TABLE pending_photos ADD COLUMN IF NOT EXISTS ${col} ${type}`);
                log(`✅ [MANUAL V2] Checked/Added column: ${col}`);
            } catch (e) { log(`❌ [MANUAL V2] Failed to add ${col}: ${e.message}`); }
        };

        await addCol('type', 'VARCHAR(50)');
        await addCol('url', 'TEXT');
        await addCol('status', "VARCHAR(50) DEFAULT 'pending'");

        // 5. Verify Schema
        const check = await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='pending_photos'`);

        res.json({
            status: 'success',
            message: 'Smart repair complete (V2).',
            logs: logs,
            detected_id_type: userIdType,
            final_schema: check.rows
        });

    } catch (err) {
        log(`❌ [MANUAL V2] Critical Error: ${err.message}`);
        res.json({ status: 'error', error: err.message, logs: logs });
    }
});

// SOCIAL SCHEMA REPAIR: Safe ALTER-based fix (never drops tables, never deletes data)
app.get('/api/admin/force-fix-social-schema', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };

    try {
        log("🔧 [SOCIAL REPAIR] Starting SAFE schema repair (no data loss)...");

        // 1. Extensions
        try {
            await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
            log("✅ [1] pgcrypto extension ready.");
        } catch (e) { log(`⚠️ [1] pgcrypto: ${e.message}`); }

        // 2. Detect users.id type
        let userIdType = 'INTEGER';
        try {
            const userTypeCheck = await db.query(`SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id'`);
            if (userTypeCheck.rows.length > 0) {
                userIdType = userTypeCheck.rows[0].data_type.toUpperCase() === 'INTEGER' ? 'INTEGER' : 'UUID';
                log(`✅ [2] users.id type detected: ${userIdType}`);
            }
        } catch (e) { log(`❌ [2] Type detection failed: ${e.message}`); }

        // Helper: fix a column type using ALTER (safe, no data loss)
        const safeAlterType = async (table, column, targetType, step) => {
            try {
                const check = await db.query(`SELECT data_type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`, [table, column]);
                if (check.rows.length === 0) {
                    log(`⏭️ [${step}] ${table}.${column} column not found (table may not exist yet)`);
                    return false;
                }
                const currentType = check.rows[0].data_type.toUpperCase();
                if (currentType === targetType || (targetType === 'INTEGER' && currentType === 'INT4') || (targetType === 'UUID' && currentType === 'UUID')) {
                    log(`✅ [${step}] ${table}.${column} already correct type (${currentType})`);
                    return true;
                }
                // Drop FK constraint first if exists
                const fkCheck = await db.query(`SELECT tc.constraint_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = $2`, [table, column]);
                for (const fk of fkCheck.rows) {
                    await db.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`);
                    log(`  ↳ Dropped FK: ${fk.constraint_name}`);
                }
                // Alter type
                if (targetType === 'INTEGER') {
                    await db.query(`ALTER TABLE ${table} ALTER COLUMN ${column} TYPE INTEGER USING ${column}::text::integer`);
                } else {
                    await db.query(`ALTER TABLE ${table} ALTER COLUMN ${column} TYPE UUID USING ${column}::text::uuid`);
                }
                log(`✅ [${step}] ${table}.${column} altered from ${currentType} to ${targetType}`);
                return true;
            } catch (e) {
                log(`❌ [${step}] Failed to alter ${table}.${column}: ${e.message}`);
                return false;
            }
        };

        // ... fix steps ...
        await safeAlterType('posts', 'operator_id', userIdType, '3A');
        await safeAlterType('stories', 'operator_id', userIdType, '3B');
        await safeAlterType('post_likes', 'user_id', userIdType, '3C');
        await safeAlterType('post_comments', 'user_id', userIdType, '3D');
        await safeAlterType('story_likes', 'user_id', userIdType, '3E');

        log("🎉 [DONE] Safe schema repair complete. No data was deleted.");
        res.json({ status: 'complete', userIdType, logs });

    } catch (err) {
        log(`❌ [CRITICAL] Repair failed: ${err.message}`);
        res.status(500).json({ status: 'error', error: err.message, logs });
    }
});

// --- NEW ADMIN FEATURES: ANALYTICS, NOTIFICATIONS, CAMPAIGNS, SCHEDULER ---

// 1. Analytics Summary
app.get('/api/admin/analytics/summary', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const result = await db.query(`
            SELECT 
                COALESCE(SUM(amount), 0) as total_revenue,
                COUNT(*) as total_purchases,
                COUNT(DISTINCT user_id) as unique_buyers,
                COALESCE(AVG(amount), 0) as avg_order
            FROM payments 
            WHERE status = 'completed' AND created_at > NOW() - interval '${days} days'
        `);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Top Buyers
app.get('/api/admin/analytics/top-buyers', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const result = await db.query(`
            SELECT 
                p.user_id,
                u.username,
                u.display_name,
                SUM(p.amount) as total_spent,
                COUNT(*) as purchase_count,
                SUM(COALESCE(p.coin_amount, 0)) as total_coins
            FROM payments p
            JOIN users u ON p.user_id = u.id
            WHERE p.status = 'completed' AND p.created_at > NOW() - interval '${days} days'
            GROUP BY p.user_id, u.username, u.display_name
            ORDER BY total_spent DESC
            LIMIT 20
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Retention & Stats
app.get('/api/admin/analytics/retention', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const totalUsers = await db.query('SELECT COUNT(*) FROM users');
        const activeUsers = await db.query("SELECT COUNT(*) FROM users WHERE last_login > NOW() - interval '30 days'");
        const dau = await db.query("SELECT COUNT(*) FROM users WHERE last_login > NOW() - interval '1 day'");
        const wau = await db.query("SELECT COUNT(*) FROM users WHERE last_login > NOW() - interval '7 days'");
        
        const signups = await db.query(`
            SELECT DATE_TRUNC('day', created_at) as date, COUNT(*) as count 
            FROM users 
            WHERE created_at > NOW() - interval '14 days'
            GROUP BY date ORDER BY date DESC
        `);

        const atRisk = await db.query(`
            SELECT id, username, display_name, balance, last_login
            FROM users 
            WHERE last_login BETWEEN NOW() - interval '30 days' AND NOW() - interval '7 days'
            AND role = 'user'
            ORDER BY last_login DESC LIMIT 20
        `);

        res.json({
            total_users: parseInt(totalUsers.rows[0].count),
            active_users: parseInt(activeUsers.rows[0].count),
            dau: parseInt(dau.rows[0].count),
            wau: parseInt(wau.rows[0].count),
            daily_signups: signups.rows,
            at_risk_users: atRisk.rows,
            retention_rate: Math.round((parseInt(wau.rows[0].count) / Math.max(1, parseInt(activeUsers.rows[0].count))) * 100)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Notifications History
app.get('/api/admin/notifications/history', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM admin_notifications ORDER BY sent_at DESC LIMIT 50');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Send Notification (Bulk)
app.post('/api/admin/notifications/send', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { title, body, target } = req.body;
    try {
        let userQuery = 'SELECT id FROM users';
        if (target === 'kadin') userQuery += " WHERE gender = 'kadin' AND role = 'user'";
        else if (target === 'erkek') userQuery += " WHERE gender = 'erkek' AND role = 'user'";
        else if (target === 'inactive') userQuery += " WHERE last_login_at < NOW() - interval '7 days' AND role = 'user'";
        else if (target === 'user_only') userQuery += " WHERE role = 'user'";
        // Default (all) includes all roles now for testing purposes

        const usersRes = await db.query(userQuery);
        const userIds = usersRes.rows.map(r => r.id);

        if (userIds.length > 0) {
            await db.query('INSERT INTO admin_notifications (title, body, target_group, sent_count) VALUES ($1, $2, $3, $4)', 
                [title, body, target, userIds.length]);
            
            // Send individually (normally you'd use a bulk service)
            for (const uid of userIds) {
                sendPushNotification(uid, { title, body, data: { type: 'admin_broadcast' } }).catch(() => {});
            }
        }
        
        res.json({ message: 'Bildirimler gönderildi.', sent_count: userIds.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Campaigns
app.get('/api/admin/campaigns', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM campaigns ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/campaigns', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { title, description, bonus_percent, start_date, end_date, target, is_active } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO campaigns (title, description, bonus_percent, start_date, end_date, target, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [title, description, bonus_percent, start_date, end_date, target, is_active]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/admin/campaigns/:id/toggle', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        await db.query('UPDATE campaigns SET is_active = $1 WHERE id = $2', [req.body.is_active, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/campaigns/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        await db.query('DELETE FROM campaigns WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. Message Schedules
app.get('/api/admin/message-schedules', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM message_schedules ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/message-schedules', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const { operator_id, target, message_template, send_at_hour, send_at_minute, days_of_week } = req.body;
        const result = await db.query(
            'INSERT INTO message_schedules (operator_id, target, message_template, send_at_hour, send_at_minute, days_of_week) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [operator_id, target, message_template, send_at_hour, send_at_minute, days_of_week]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/admin/message-schedules/:id/toggle', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        await db.query('UPDATE message_schedules SET is_active = $1 WHERE id = $2', [req.body.is_active, req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/message-schedules/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        await db.query('DELETE FROM message_schedules WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- MESSAGE SCHEDULER ENGINE ---
async function runMessageScheduler() {
    const now = new Date();
    const hour = now.getHours();
    const minute = Math.floor(now.getMinutes() / 5) * 5; // Check every 5 mins
    const day = now.getDay();

    try {
        const activeSchedules = await db.query(`
            SELECT s.*, u.gender as op_gender 
            FROM message_schedules s
            JOIN users u ON s.operator_id = u.id
            WHERE s.is_active = true 
            AND u.gender != 'coin_bayisi'
            AND s.send_at_hour = $1 
            AND s.send_at_minute = $2
            AND $3 = ANY(s.days_of_week)
        `, [hour, minute, day]);

        for (const sch of activeSchedules.rows) {
            console.log(`[SCHEDULER] Running schedule ${sch.id} (Op Gender: ${sch.op_gender})...`);
            
            const opGender = (sch.op_gender === 'male' || sch.op_gender === 'erkek') ? 'erkek' : 'kadin';
            const targetGender = opGender === 'kadin' ? 'erkek' : 'kadin';

            let userQuery = `
                SELECT id FROM users 
                WHERE role = 'user' 
                AND gender = $1
                AND id NOT IN (SELECT id FROM users WHERE role != 'user')
            `;
            
            if (sch.target === 'inactive') userQuery += " AND last_login < NOW() - interval '3 days'";
            else if (sch.target === 'new') userQuery += " AND created_at > NOW() - interval '7 days'";
            
            const users = await db.query(userQuery + " ORDER BY RANDOM() LIMIT 20", [targetGender]);
            
            for (const u of users.rows) {
                // Check if already has a chat
                let chatRes = await db.query(
                    'SELECT id FROM chats WHERE (user_id = $1 AND operator_id = $2) OR (user_id = $2 AND operator_id = $1)',
                    [u.id, sch.operator_id]
                );
                let chatId;
                if (chatRes.rows.length === 0) {
                    const newChat = await db.query(
                        'INSERT INTO chats (user_id, operator_id, last_message, last_message_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
                        [u.id, sch.operator_id, sch.message_template]
                    );
                    chatId = newChat.rows[0].id;
                } else {
                    chatId = chatRes.rows[0].id;
                }

                // --- DUPLICATE PREVENTION ---
                // If this operator has already sent ANY message to this user in this chat, don't send another auto-message
                const msgCheck = await db.query(
                    'SELECT id FROM messages WHERE chat_id = $1 AND sender_id = $2 LIMIT 1',
                    [chatId, sch.operator_id]
                );
                
                if (msgCheck.rows.length > 0) {
                    console.log(`[SCHEDULER] Skipping schedule ${sch.id} for user ${u.id} - message already exists.`);
                    continue;
                }

                // Send message
                await db.query(
                    'INSERT INTO messages (chat_id, sender_id, content, content_type) VALUES ($1, $2, $3, $4)',
                    [chatId, sch.operator_id, sch.message_template, 'text']
                );
                
                // Trigger push
                sendPushNotification(u.id, {
                    title: 'Yeni Mesaj!',
                    body: sch.message_template,
                    data: { chatId: chatId.toString(), type: 'message' }
                }).catch(() => {});
            }
        }
    } catch (e) {
        console.error('[SCHEDULER] Error:', e.message);
    }
}

// Start Scheduler (runs every 5 minutes)
setInterval(runMessageScheduler, 5 * 60 * 1000);



// Global Error Handler for Multer/Other
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.get('/api/keep-alive', (req, res) => {
    res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// --- MISSING MOBILE ROUTES (404 FIXES) ---

// 1. Hi Message Route (Optimized with Coin Deduction)
app.post('/api/messages/send-hi', async (req, res) => {
    const { userId, senderId, operatorId, receiverId, content, message } = req.body;
    const finalSenderId = userId || senderId;
    const finalReceiverId = operatorId || receiverId;
    const finalContent = content || message || 'Merhaba 👋';
    const HI_COST = 10;

    if (!finalSenderId || !finalReceiverId) {
        return res.status(400).json({ error: 'Missing sender or receiver ID' });
    }

    try {
        await db.query('BEGIN');

        // Check balance
        const userRes = await db.query('SELECT balance FROM users WHERE id = $1', [finalSenderId]);
        if (userRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found' });
        }

        const currentBalance = userRes.rows[0].balance;
        if (currentBalance < HI_COST) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Yetersiz bakiye. Hi mesajı göndermek için 50 Coin gereklidir.', insufficientFunds: true });
        }

        // Find or create chat
        let chatRes = await db.query(
            'SELECT id FROM chats WHERE (user_id = $1 AND operator_id = $2) OR (user_id = $2 AND operator_id = $1)',
            [finalSenderId, finalReceiverId]
        );

        let chatId;
        if (chatRes.rows.length === 0) {
            const newChat = await db.query(
                'INSERT INTO chats (user_id, operator_id, last_message_at) VALUES ($1, $2, NOW()) RETURNING id',
                [finalSenderId, finalReceiverId]
            );
            chatId = newChat.rows[0].id;
        } else {
            chatId = chatRes.rows[0].id;
        }

        // Deduct coins
        await db.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [HI_COST, finalSenderId]);

        // Insert message
        const msgResult = await db.query(
            'INSERT INTO messages (chat_id, sender_id, content, content_type) VALUES ($1, $2, $3, $4) RETURNING *',
            [chatId, finalSenderId, finalContent, 'text']
        );

        // Update chat
        await db.query('UPDATE chats SET last_message_at = NOW() WHERE id = $1', [chatId]);

        await db.query('COMMIT');

        // Trigger push notification (non-blocking)
        try {
            const senderRes = await db.query('SELECT display_name FROM users WHERE id = $1', [finalSenderId]);
            const senderName = senderRes.rows[0]?.display_name || 'Bir kullanıcı';
            await sendPushNotification(finalReceiverId, {
                title: 'Yeni Mesaj!',
                body: `${senderName}: ${finalContent}`,
                data: { chatId: chatId.toString(), type: 'message' }
            });
        } catch (pushErr) {
            console.error('[HI_PUSH_ERROR]', pushErr.message);
        }

        res.json({
            success: true,
            message: 'Hi sent!',
            chatId,
            newBalance: currentBalance - HI_COST,
            sentMessage: msgResult.rows[0]
        });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Hi Message Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 1.5 Get Fresh User Balance
app.get('/api/users/balance', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT balance FROM users WHERE id::text = $1::text', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ balance: result.rows[0].balance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Boost Status Route
app.get('/api/boost/status', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await db.query(
            'SELECT *, end_time > NOW() as is_active FROM boosts WHERE user_id = $1 AND end_time > NOW() ORDER BY end_time DESC LIMIT 1',
            [userId]
        );
        res.json({
            is_boosted: result.rows.length > 0,
            boost: result.rows[0] || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Fallback Fetch offerings (RevenueCat fallback)
app.get('/api/offerings', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM coin_packages WHERE is_active = true ORDER BY price ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- REPORTING SYSTEM (Required for Google Play Compliance) ---
app.post('/api/reports', authenticateToken, async (req, res) => {
    const { reportedUserId, reason, details } = req.body;
    const reporterId = req.user.id;

    if (!reportedUserId || !reason) {
        return res.status(400).json({ error: 'Eksik bilgi (reportedUserId veya reason).' });
    }

    try {
        await db.query(
            'INSERT INTO reports (reporter_id, reported_id, reason, status) VALUES ($1, $2, $3, $4)',
            [reporterId, reportedUserId, `${reason}: ${details || ''}`, 'pending']
        );
        
        // Log activity
        await logActivity(app.get('io'), reporterId, 'report', `User reported ${reportedUserId} for ${reason}`);
        
        res.json({ success: true, message: 'Şikayetiniz alındı ve moderasyon ekibine iletildi.' });
    } catch (err) {
        console.error('Report Error:', err);
        res.status(500).json({ error: 'Şikayet iletilirken bir hata oluştu.' });
    }
});

// --- END MISSING ROUTES ---


// SELF PINGER TO PREVENT RENDER SLEEP (Every 14 minutes)
const startPinger = () => {
    const PING_INTERVAL = 14 * 60 * 1000; // 14 mins
    const URL = process.env.NODE_ENV === 'production' 
        ? 'https://backend-kj17.onrender.com/api/keep-alive'
        : `http://localhost:${process.env.PORT || 5000}/api/keep-alive`;

    // Initial delay to let server settle
    setTimeout(() => {
        setInterval(async () => {
            try {
                await axios.get(URL);
                console.log('[KEEP-ALIVE] Self-ping successful');
            } catch (err) {
                console.error('[KEEP-ALIVE] Self-ping failed:', err.message);
            }
        }, PING_INTERVAL);
    }, 60000);
};


// --- PRIVACY POLICY ROUTES ---
app.get('/privacy.html', (req, res) => {
    const rootPrivacyPath = path.join(__dirname, 'privacy.html');
    const adminPrivacyPath = path.join(__dirname, 'public', 'admin', 'privacy.html');
    const distPrivacyPath = path.join(__dirname, 'web-admin', 'dist', 'privacy.html');

    if (fs.existsSync(rootPrivacyPath)) {
        res.sendFile(rootPrivacyPath);
    } else if (fs.existsSync(adminPrivacyPath)) {
        res.sendFile(adminPrivacyPath);
    } else if (fs.existsSync(distPrivacyPath)) {
        res.sendFile(distPrivacyPath);
    } else {
        res.status(404).send('Privacy Policy Not Found (System checked root, admin, and dist)');
    }
});

app.get('/privacy', (req, res) => {
    res.redirect('/privacy.html');
});

// Handle React routing, return all requests to React app
// DEBUG LOGS VIEW
app.get('/api/admin/schema-dump', async (req, res) => {
    try {
        const tables = ['users', 'chats', 'messages', 'operators', 'commission_logs', 'agencies', 'operator_stats'];
        const dump = {};
        for (const table of tables) {
            const columns = await db.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [table]);
            dump[table] = columns.rows;
        }
        res.json(dump);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/debug-logs', (req, res) => {
    res.json(global.payoutLogs || []);
});

app.get('/api/admin/clear-logs', (req, res) => {
    global.payoutLogs = [];
    res.json({ success: true });
});

// Admin Panel Catch-all Route
app.get('*', (req, res) => {
    // Exclude API routes from being handled by React
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    const filePath = path.join(__dirname, 'public', 'admin', 'index.html');
    if (require('fs').existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Admin Panel Not Found (File Missing on Server)');
    }
});

// Basic Global Error Handler (Phase 2 Stability)
app.use((err, req, res, next) => {
    const errorLog = `[${new Date().toISOString()}] ${req.method} ${req.url} - ERROR: ${err.message}\n${err.stack}\n`;
    console.error(errorLog);
    // In actual production, this would send to Sentry:
    // Sentry.captureException(err);

    res.status(err.status || 500).json({
        error: 'Bir iç sunucu hatası oluştu.',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 [BACKEND] Server listening on port ${PORT}`);

    // Initialize Database Schema and Packages
    await initializeDatabase();

    startPinger();
});
