const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();
const bcrypt = require('bcrypt');
const { authenticateToken, authorizeRole, SECRET_KEY } = require('./middleware/auth');
const { getVipLevel, getVipProgress } = require('./utils/vipUtils');
const jwt = require('jsonwebtoken');

const app = express();
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- DATABASE AUTO-MIGRATION ---
const initializeDatabase = async () => {
    try {
        console.log('[DB] VERIFYING SCHEMA...');

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

        if (!columnNames.includes('job')) {
            console.log('[DB] Adding missing column: job');
            await db.query('ALTER TABLE users ADD COLUMN job VARCHAR(100)');
        }

        if (!columnNames.includes('edu')) {
            console.log('[DB] Adding missing column: edu');
            await db.query('ALTER TABLE users ADD COLUMN edu VARCHAR(100)');
        }

        if (!columnNames.includes('onboarding_completed')) {
            console.log('[DB] Adding missing column: onboarding_completed');
            await db.query('ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT false');
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

        if (!columnNames.includes('onboarding_completed')) {
            console.log('[DB] Adding missing column: onboarding_completed');
            await db.query('ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE');
        }
        if (!columnNames.includes('phone')) {
            console.log('[DB] Adding missing column: phone');
            await db.query('ALTER TABLE users ADD COLUMN phone VARCHAR(20) UNIQUE');
        }

        if (!columnNames.includes('interests')) {
            console.log('[DB] Adding missing column: interests');
            await db.query('ALTER TABLE users ADD COLUMN interests TEXT');
        }

        // Migration logic
        await db.query(`
            UPDATE users SET vip_level = 1 
            WHERE is_vip = true AND (vip_level IS NULL OR vip_level = 0)
        `);

        console.log('[DB] SCHEMA VERIFICATION COMPLETE');
    } catch (err) {
        console.error('[DB] CRITICAL SCHEMA ERROR:', err.message);
    }
};
initializeDatabase();

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

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        console.log('[MULTER] Resolving destination for:', file.originalname);
        console.log('[MULTER] destination folder:', uploadsDir);
        if (!fs.existsSync(uploadsDir)) {
            console.log('[MULTER] Directory missing, creating...');
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const fname = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        console.log('[MULTER] Generating filename:', fname);
        cb(null, fname);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));

// Serve Admin Panel index.html for unknown /admin routes (SPA support)
app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin', 'index.html'));
});

// Helper: Sanitize User (Rewrite URLs)
const sanitizeUser = (user, req) => {
    if (!user) return null;
    const protocol = req.protocol;
    const host = req.get('host');

    const newUser = { ...user };

    // Rewrite Avatar
    if (newUser.avatar_url && !newUser.avatar_url.startsWith('http')) {
        newUser.avatar_url = `${protocol}://${host}${newUser.avatar_url.startsWith('/') ? '' : '/'}${newUser.avatar_url}`;
    }

    // Pass through onboarding status
    newUser.onboarding_completed = !!user.onboarding_completed;

    // Rewrite Photos array if exists (for operators)
    if (newUser.photos && Array.isArray(newUser.photos)) {
        newUser.photos = newUser.photos.map(p => {
            if (p && !p.startsWith('http')) {
                return `${protocol}://${host}${p.startsWith('/') ? '' : '/'}${p}`;
            }
            return p;
        });
    }

    return newUser;
};

// Helper: Log Activity & Emit Socket Event
const logActivity = async (userId, actionType, description) => {
    try {
        // 1. Insert into DB
        const result = await db.query(
            'INSERT INTO activities (user_id, action_type, description) VALUES ($1, $2, $3) RETURNING *',
            [userId, actionType, description]
        );

        // 2. Fetch User Details for UI
        const act = result.rows[0];
        const userRes = await db.query('SELECT username, avatar_url FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0] || { username: 'Unknown', avatar_url: '' };

        const fullActivity = { ...act, user_name: user.username, user_avatar: user.avatar_url };

        // 3. Emit Real-time Event
        io.emit('new_activity', fullActivity);

        return fullActivity;
    } catch (err) {
        console.error("Log Activity Error:", err.message);
    }
};

// --- REST API ROUTES ---

// GET USER PROFILE
app.get('/api/users/:id', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(sanitizeUser(result.rows[0], req));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER PROFILE
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, display_name, age, gender, bio, job, edu } = req.body;

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
            [finalDisplayName || null, finalName || null, age ? parseInt(age) : null, gender || null, bio || null, job || null, edu || null, id]
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
    const { display_name, name, bio, avatar_url, gender, interests, onboarding_completed } = req.body;

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
                age = COALESCE($8::INTEGER, age)
             WHERE id = $9 RETURNING *`,
            [
                req.body.display_name || null,
                req.body.name || null,
                req.body.bio || null,
                req.body.avatar_url || null,
                req.body.gender || null,
                req.body.interests || null,
                req.body.onboarding_completed !== undefined ? req.body.onboarding_completed : null,
                (req.body.age && !isNaN(parseInt(req.body.age))) ? parseInt(req.body.age) : null,
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

// --- RESILIENT DATABASE INITIALIZATION ---
(async () => {
    try {
        console.log("🚀 [DB] Starting Resilient Initialization...");

        // 0. Ensure search path and extensions
        try {
            await db.query('SET search_path TO public');
            await db.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
            console.log("✅ [DB] Environment ensured (public schema, pgcrypto).");
        } catch (e) {
            console.warn("⚠️ [DB] Non-critical error ensuring environment:", e.message);
        }

        const runQuery = async (name, query) => {
            try {
                await db.query(query);
                console.log(`✅ [DB] ${name} complete.`);
            } catch (e) {
                console.error(`❌ [DB] ${name} failed:`, e.message);
                // We keep going so other tables can be fixed!
            }
        };

        // 1. Critical Base Tables
        await runQuery("Users Table", `CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE,
            balance INTEGER DEFAULT 0,
            profile_image TEXT,
            gender VARCHAR(10) DEFAULT 'kadin',
            display_name VARCHAR(255),
            total_spent DECIMAL(10, 2) DEFAULT 0,
            vip_level INTEGER DEFAULT 0,
            account_status VARCHAR(50) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        // 2. Pending Photos (The blocker!) - Force recreation if schema is wrong
        console.log("🔄 [DB] Syncing pending_photos...");
        try {
            // Check if column exists
            const check = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='pending_photos' AND column_name='type'`);
            if (check.rows.length === 0) {
                console.log("⚠️ [DB] 'type' column missing in pending_photos. Recreating table...");
                await db.query(`DROP TABLE IF EXISTS pending_photos CASCADE`);
                await db.query(`CREATE TABLE pending_photos (
                    id SERIAL PRIMARY KEY,
                    user_id UUID REFERENCES users(id),
                    type VARCHAR(50),
                    url TEXT,
                    status VARCHAR(50) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT NOW()
                )`);
                console.log("✅ [DB] pending_photos recreated with 'type' column.");
            } else {
                console.log("✅ [DB] pending_photos already has 'type' column.");
            }
        } catch (e) {
            console.error("❌ [DB] Failed to sync pending_photos:", e.message);
            // Emergency fallback: try to create it if it doesn't exist at all
            await runQuery("Pending Photos (Fallback)", `CREATE TABLE IF NOT EXISTS pending_photos (
                id SERIAL PRIMARY KEY,
                user_id UUID REFERENCES users(id),
                type VARCHAR(50),
                url TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW()
            )`);
        }

        // 3. Other Tables (Isolated)
        await runQuery("Operators Table", `CREATE TABLE IF NOT EXISTS operators (
            id SERIAL PRIMARY KEY,
            user_id UUID REFERENCES users(id),
            name VARCHAR(255) NOT NULL,
            image TEXT,
            is_online BOOLEAN DEFAULT TRUE,
            job VARCHAR(100)
        )`);

        await runQuery("Chats Table", `CREATE TABLE IF NOT EXISTS chats (
            id SERIAL PRIMARY KEY,
            user_id UUID REFERENCES users(id),
            operator_id UUID REFERENCES users(id),
            last_message TEXT,
            unread_count INTEGER DEFAULT 0,
            last_message_at TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        await runQuery("Messages Table", `CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            chat_id INTEGER REFERENCES chats(id),
            sender_id UUID REFERENCES users(id),
            content TEXT,
            content_type VARCHAR(50) DEFAULT 'text',
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        // 4. Migrations (Isolated)
        await runQuery("Migration: Users Gender", `ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(10) DEFAULT 'kadin'`);
        await runQuery("Migration: Users Display Name", `ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)`);
        await runQuery("Migration: Users Bio", `ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`);
        await runQuery("Migration: Users Job/Edu", `ALTER TABLE users ADD COLUMN IF NOT EXISTS job VARCHAR(100), ADD COLUMN IF NOT EXISTS edu VARCHAR(100)`);
        await runQuery("Migration: Users Age", `ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER`);
        await runQuery("Migration: Users Interests", `ALTER TABLE users ADD COLUMN IF NOT EXISTS interests TEXT`);
        await runQuery("Migration: Users Onboarding", `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false`);
        await runQuery("Migration: Users Account Status", `ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active'`);
        await runQuery("Migration: User Avatar", `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
        await runQuery("Migration: User Account Status", `ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'active'`);
        await runQuery("Migration: Operator Job", `ALTER TABLE operators ADD COLUMN IF NOT EXISTS job VARCHAR(100)`);
        await runQuery("Migration: Chats Last Msg", `ALTER TABLE chats ADD COLUMN IF NOT EXISTS last_message TEXT`);
        await runQuery("Migration: Chats Unread", `ALTER TABLE chats ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0`);
        await runQuery("Migration: Coin Packages", `CREATE TABLE IF NOT EXISTS coin_packages (id SERIAL PRIMARY KEY, name TEXT NOT NULL, coins INTEGER NOT NULL, price DECIMAL(10,2) NOT NULL, is_popular BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW())`);
        await runQuery("Migration: Gifts Table", `CREATE TABLE IF NOT EXISTS gifts (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, cost INTEGER NOT NULL, icon_url TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())`);
        await runQuery("Migration: Activities Table", `CREATE TABLE IF NOT EXISTS activities (id SERIAL PRIMARY KEY, user_id UUID REFERENCES users(id), action_type VARCHAR(50), description TEXT, created_at TIMESTAMP DEFAULT NOW())`);

        console.log("🏁 [DB] Initialization flow completed.");
    } catch (err) {
        console.error('❌ [DB] UNEXPECTED INITIALIZATION ERROR:', err.message);
    }
})();

// Health Check
app.get('/', (req, res) => {
    res.send('Chat System Backend is Running (FIX_V18)');
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


// ... (existing routes) ...

// --- ADMIN USER MANAGEMENT ---

// MANUAL EMERGENCY FIX: Smart Schema Repair
app.get('/api/admin/force-fix-schema', async (req, res) => {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };

    // 1. Basic security check
    if (req.query.secret !== 'falka_fix_now') {
        return res.json({ status: 'error', message: 'Access Denied', logs });
    }

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

// TEMP: One-time Setup Route for Production with Auto-Migration
app.get('/api/setup-admin', async (req, res) => {
    // Basic secret check
    const secret = req.query.secret;
    if (secret !== 'falka_setup_2024') return res.status(403).send('Forbidden');

    try {
        console.log("Starting Auto-Migration...");

        // 1. Comprehensive Auto-Migration: Add ALL potentially missing columns
        const migrations = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS balance INT DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT 'https://via.placeholder.com/150'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(10) DEFAULT 'kadin'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",
            "ALTER TABLE operators ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)",
            "ALTER TABLE operators ADD COLUMN IF NOT EXISTS category VARCHAR(100)",
            "ALTER TABLE operators ADD COLUMN IF NOT EXISTS bio TEXT",
            "ALTER TABLE operators ADD COLUMN IF NOT EXISTS photos TEXT[]",
            "ALTER TABLE operators ADD COLUMN IF NOT EXISTS rating DECIMAL(3, 1) DEFAULT 5.0",
            "ALTER TABLE operators ALTER COLUMN name DROP NOT NULL",
            "DO $$ BEGIN IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='pending_photos' AND column_name='photo_url') THEN ALTER TABLE pending_photos RENAME COLUMN photo_url TO url; END IF; END $$",
            "ALTER TABLE pending_photos ADD COLUMN IF NOT EXISTS type VARCHAR(50)",
            "ALTER TABLE pending_photos ALTER COLUMN url DROP NOT NULL",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMP",
            "CREATE TABLE IF NOT EXISTS coin_packages (id SERIAL PRIMARY KEY, name TEXT NOT NULL, coins INTEGER NOT NULL, price DECIMAL(10,2) NOT NULL, is_popular BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW())",
            "CREATE TABLE IF NOT EXISTS gifts (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, cost INTEGER NOT NULL, icon_url TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())",
            "CREATE TABLE IF NOT EXISTS quick_replies (id SERIAL PRIMARY KEY, title VARCHAR(100) NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT NOW())"
        ];

        // Create Transactions Table
        await db.query(`CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            amount DECIMAL(10, 2) NOT NULL,
            package_name VARCHAR(255),
            status VARCHAR(50) DEFAULT 'completed',
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        // Create Activities Table (Real-time logs)
        await db.query(`CREATE TABLE IF NOT EXISTS activities (
            id SERIAL PRIMARY KEY,
            user_id UUID REFERENCES users(id),
            action_type VARCHAR(50),
            description TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        // Drop and Recreate Pending Photos Table to ensure schema match (Safe for now as it's just moderation data)
        console.log("[DB] Recreating pending_photos table to fix schema mismatch...");
        await db.query(`DROP TABLE IF EXISTS pending_photos CASCADE`);
        await db.query(`CREATE TABLE pending_photos (
            id SERIAL PRIMARY KEY,
            user_id UUID REFERENCES users(id),
            type VARCHAR(50),
            url TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW()
        )`);
        console.log("[DB] pending_photos table recreated successfully.");

        for (const query of migrations) {
            try {
                await db.query(query);
            } catch (migErr) {
                console.warn(`Migration step failed: ${query}`, migErr.message);
            }
        }

        // --- SPECIAL MIGRATION: BACKFILL OPERATOR USER_IDs ---
        console.log("Checking for legacy operators...");
        const legacyOps = await db.query("SELECT * FROM operators WHERE user_id IS NULL");
        for (const op of legacyOps.rows) {
            try {
                // Try to find matching user by name
                // (Assuming operator 'name' matches user 'username' or 'display_name')
                // If name is null, we can't do much, skip or use ID.
                const opName = op.name || `Operator_${op.id}`;
                const uniqueEmail = `op_${op.id}_${Date.now()}@falka.com`; // Fallback email

                let userId = null;

                // 1. Check if user exists (rough match)
                const userCheck = await db.query("SELECT id FROM users WHERE username = $1 OR display_name = $1", [opName]);
                if (userCheck.rows.length > 0) {
                    userId = userCheck.rows[0].id;
                } else {
                    // 2. Create User for this Operator
                    const newUser = await db.query(
                        "INSERT INTO users (username, email, password, password_hash, role, balance, account_status, display_name, avatar_url, gender) VALUES ($1, $2, $3, $3, 'operator', 0, 'active', $4, $5, $6) RETURNING id",
                        [opName.replace(/\s+/g, '_').toLowerCase() + '_' + op.id, uniqueEmail, await bcrypt.hash('123456', 10), opName, 'https://via.placeholder.com/150', 'kadin']
                    );
                    userId = newUser.rows[0].id;
                }

                // 3. Link them
                await db.query("UPDATE operators SET user_id = $1 WHERE id = $2", [userId, op.id]);
                console.log(`Migrated Operator ${op.id} -> User ${userId}`);

            } catch (err) {
                console.error(`Failed to migrate operator ${op.id}:`, err.message);
            }
        }

        // --- SPECIAL MIGRATION: FIX CHATS & MESSAGES ---
        console.log("Fixing legacy chats...");
        // 1. Update Chats: operator_id (old op id) -> operator_id (new user id)
        // We join on operators table where id matches the chat's current operator_id
        await db.query(`
            UPDATE chats c
            SET operator_id = o.user_id
            FROM operators o
            WHERE c.operator_id = o.id
            AND o.user_id IS NOT NULL
            AND c.operator_id != o.user_id
        `);

        // 2. Update Messages: sender_id (old op id) -> sender_id (new user id)
        // We find messages where sender is NOT the user (so it's the operator)
        // and update sender_id to match the chat's (now updated) operator_id
        await db.query(`
            UPDATE messages m
            SET sender_id = c.operator_id
            FROM chats c
            WHERE m.chat_id = c.id
            AND m.sender_id != c.user_id
            AND m.sender_id != c.operator_id
        `);
        // -----------------------------------------------------

        // Try to drop NOT NULL constraint on legacy 'password' column if it exists and causes issues
        try {
            await db.query("ALTER TABLE users ALTER COLUMN password DROP NOT NULL");
        } catch (migErr) {
            console.warn("Could not drop NOT NULL on password (maybe okay):", migErr.message);
        }

        // 2. Create Admin
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // Check if admin exists
        const check = await db.query("SELECT * FROM users WHERE username = 'admin' OR email = 'admin@falka.com'");
        if (check.rows.length === 0) {
            await db.query(
                "INSERT INTO users (username, email, password, password_hash, role, balance, account_status) VALUES ($1, $2, $3, $3, 'admin', 0, 'active')",
                ['admin', 'admin@falka.com', hashedPassword]
            );
            res.send('<h1>Success!</h1><p>Database columns repaired.</p><p>Transactions table created.</p><p>Admin user created.</p>');
        } else {
            await db.query("UPDATE users SET password_hash = $1, role = 'admin', account_status = 'active', email = 'admin@falka.com' WHERE username = 'admin'", [hashedPassword]);
            res.send('<h1>Success!</h1><p>Database columns repaired.</p><p>Transactions table checked.</p><p>Admin user verified.</p>');
        }

    } catch (err) {
        console.error("Setup Error:", err);
        res.status(500).send(`<h1>Error</h1><p>${err.message}</p><pre>${JSON.stringify(err, null, 2)}</pre>`);
    }
});

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

        res.json({
            revenue: parseFloat(totalRevenue).toFixed(2),
            activeUsers: parseInt(activeUsers),
            messages: parseInt(totalMessages),
            onlineOperators: parseInt(onlineOperators),
            charts: {
                revenue: revenueChart.rows,
                registrations: registrationChart.rows
            }
        });
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
        const result = await db.query("SELECT id, username, email, role, created_at FROM users WHERE role IN ('admin', 'moderator', 'operator') ORDER BY created_at DESC");
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
    const { name, coins, price, is_popular } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO coin_packages (name, coins, price, is_popular) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, coins, price, is_popular || false]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/packages/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { name, coins, price, is_popular } = req.body;
    try {
        const result = await db.query(
            'UPDATE coin_packages SET name = $1, coins = $2, price = $3, is_popular = $4 WHERE id = $5 RETURNING *',
            [name, coins, price, is_popular, id]
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

// CREATE STAFF
app.post('/api/admin/staff', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { username, email, password, role } = req.body;
    if (!['admin', 'moderator', 'operator'].includes(role)) return res.status(400).json({ error: 'Geçersiz rol.' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.query(
            "INSERT INTO users (username, email, password, password_hash, role, balance) VALUES ($1, $2, $3, $3, $4, 0) RETURNING id, username, email, role",
            [username, email, hashedPassword, role]
        );

        // If Operator, add to operators table too
        if (role === 'operator') {
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
        await db.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET ALL USERS (Manager/Admin Only)
app.get('/api/admin/users', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, username, email, role, account_status, balance, 
                   is_vip, created_at, last_login_at, ban_expires_at, avatar_url 
            FROM users 
            WHERE role = 'user' 
            ORDER BY created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
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
            'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance',
            [amount, id]
        );

        // Log transaction
        await db.query(
            'INSERT INTO transactions (user_id, amount, package_name, status) VALUES ($1, $2, $3, $4)',
            [id, amount, amount > 0 ? 'Admin Ekleme' : 'Admin Ceza', 'completed']
        );

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

// CREATE NEW ADMIN/MODERATOR (Manager/Admin Only)
app.post('/api/admin/users', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { username, email, password, role } = req.body;

    // Validate role
    if (!['admin', 'moderator', 'operator', 'user'].includes(role)) {
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

    if (!['admin', 'moderator', 'operator', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Geçersiz rol.' });
    }

    try {
        const result = await db.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
            [role, id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

        res.json(result.rows[0]);
    } catch (err) {
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
        await db.query('DELETE FROM users WHERE id = $1', [id]);
        res.json({ success: true, message: 'Kullanıcı silindi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// REPORT USER
app.post('/api/report', async (req, res) => {
    const { reporterId, reportedId, reason, details } = req.body;
    try {
        await db.query('INSERT INTO reports (reporter_id, reported_id, reason, details) VALUES ($1, $2, $3, $4)',
            [reporterId, reportedId, reason, details]);

        await db.query("UPDATE users SET account_status = 'under_review' WHERE id = $1", [reportedId]);

        res.json({ success: true, message: 'Kullanıcı raporlandı.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// BLOCK USER
app.post('/api/block', async (req, res) => {
    const { blockerId, blockedId } = req.body;
    try {
        await db.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)', [blockerId, blockedId]);
        res.json({ success: true, message: 'Kullanıcı engellendi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ... (existing admin routes) ...

// SIMULATED PURCHASE (Update VIP & Balance) - UPDATED WITH TRANSACTION LOG
app.post('/api/purchase', async (req, res) => {
    const { userId, amount, coins, packageName } = req.body;
    const price = parseFloat(amount); // Ensure float

    try {
        await db.query('BEGIN');

        // 1. Get current user data
        const userRes = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) throw new Error('User not found');

        let currentTotal = parseFloat(userRes.rows[0].total_spent || 0);
        let currentBalance = parseInt(userRes.rows[0].balance || 0);

        // 2. Calculate new values
        const newTotal = currentTotal + price;
        const newBalance = currentBalance + (coins || 0);

        // 3. Determine VIP Level
        let newVipLevel = 0;
        if (newTotal >= 5000) newVipLevel = 5;
        else if (newTotal >= 3500) newVipLevel = 4;
        else if (newTotal >= 2000) newVipLevel = 3;
        else if (newTotal >= 1000) newVipLevel = 2;
        else if (newTotal >= 500) newVipLevel = 1;

        // 4. Update User Data
        await db.query(
            'UPDATE users SET total_spent = $1, vip_level = $2, balance = $3 WHERE id = $4',
            [newTotal, newVipLevel, newBalance, userId]
        );

        // 5. Log Transaction
        await db.query(
            'INSERT INTO transactions (user_id, amount, package_name, status) VALUES ($1, $2, $3, $4)',
            [userId, price, packageName || 'Coin Pack', 'completed']
        );

        // Log Purchase Activity
        logActivity(userId, 'purchase', `${price} TL tutarında ${packageName || 'paket'} satın aldı.`);

        await db.query('COMMIT');

        res.json({
            success: true,
            balance: newBalance,
            vip_level: newVipLevel,
            total_spent: newTotal
        });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Purchase Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- AUTH REFACTOR: OTP & PASSWORDLESS ---

// Temporary OTP storage (In production use Redis or a DB table with expires)
const otpStore = new Map();

app.post('/api/auth/request-otp', async (req, res) => {
    const { email, phone } = req.body;
    const identifier = email || phone;

    if (!identifier) return res.status(400).json({ error: 'Email veya Telefon gerekli.' });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with 5 mins expiry
    otpStore.set(identifier, { otp, expires: Date.now() + 5 * 60 * 1000 });

    console.log(`[OTP] Request for ${identifier}: ${otp}`); // For dev, log it

    // In production, send SMS via Twilio or Email via Nodemailer
    // res.json({ success: true, message: 'OTP gönderildi.' });

    // FOR DEV: Return OTP so we can test without SMS/Email service
    res.json({ success: true, message: 'OTP gönderildi.', dev_otp: otp });
});

app.post('/api/auth/verify-otp', async (req, res) => {
    const { email, phone, otp } = req.body;
    const identifier = email || phone;

    const storedData = otpStore.get(identifier);

    if (!storedData || storedData.otp !== otp || Date.now() > storedData.expires) {
        return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş kod.' });
    }

    // OTP Correct, clear it
    otpStore.delete(identifier);

    try {
        // Find or Create User
        let result;
        if (email) {
            result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        } else {
            result = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
        }

        let user;
        if (result.rows.length === 0) {
            // Register New User (Signup)
            const username = email ? email.split('@')[0] : `user_${Math.floor(1000 + Math.random() * 9000)}`;
            const insertResult = await db.query(
                "INSERT INTO users (username, email, phone, role, balance, avatar_url, display_name) VALUES ($1, $2, $3, 'user', 100, 'https://via.placeholder.com/150', $4) RETURNING *",
                [username, email || null, phone || null, username]
            );
            user = insertResult.rows[0];
            logActivity(user.id, 'register', 'Yeni kullanıcı OTP ile kayıt oldu.');
            io.emit('new_user', sanitizeUser(user, req));
        } else {
            // Login Existing User
            user = result.rows[0];
            logActivity(user.id, 'login', 'Kullanıcı OTP ile giriş yaptı.');
        }

        // Check Account Status
        if (user.account_status !== 'active') {
            return res.status(403).json({ error: 'Hesabınız askıya alınmış.' });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, display_name: user.display_name, avatar_url: user.avatar_url },
            SECRET_KEY,
            { expiresIn: '30d' }
        );

        res.json({ user: sanitizeUser(user, req), token });

    } catch (err) {
        console.error("OTP Verify Error:", err.message);
        res.status(500).json({ error: 'Giriş işlemi sırasında bir hata oluştu.' });
    }
});

// --- END AUTH REFACTOR ---

// --- TRADITIONAL EMAIL AUTH (EPHEMERAL/TRANSITION) ---
app.post('/api/auth/register-email', async (req, res) => {
    const { email, password, username, display_name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email ve şifre zorunludur.' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const finalUsername = username || email.split('@')[0] + '_' + Math.floor(Math.random() * 1000);

        const result = await db.query(
            "INSERT INTO users (username, email, password, password_hash, role, balance, display_name, avatar_url) VALUES ($1, $2, $3, $3, 'user', 100, $4, 'https://via.placeholder.com/150') RETURNING *",
            [finalUsername, email, hashedPassword, display_name || finalUsername]
        );

        const user = result.rows[0];
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, display_name: user.display_name, avatar_url: user.avatar_url },
            SECRET_KEY,
            { expiresIn: '30d' }
        );

        logActivity(user.id, 'register', 'Yeni kullanıcı e-posta ile kayıt oldu.');
        io.emit('new_user', sanitizeUser(user, req));
        res.status(201).json({ user: sanitizeUser(user, req), token });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanımda.' });
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login-email', async (req, res) => {
    const { email, password } = req.body;
    console.log('[LOGIN] Attempt for email:', email);

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            console.log('[LOGIN] User not found:', email);
            return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
        }

        const user = result.rows[0];
        console.log('[LOGIN] User found, checking password...');

        const valid = await bcrypt.compare(password, user.password_hash || user.password);

        if (!valid) {
            console.log('[LOGIN] Invalid password for:', email);
            return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
        }

        console.log('[LOGIN] Success for:', email);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, display_name: user.display_name, avatar_url: user.avatar_url },
            SECRET_KEY,
            { expiresIn: '30d' }
        );

        logActivity(user.id, 'login', 'Kullanıcı e-posta ile giriş yaptı.');
        res.json({ user: sanitizeUser(user, req), token });
    } catch (err) {
        console.error('[LOGIN] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});
// --- END TRADITIONAL EMAIL AUTH ---

// TEMPORARY ADMIN ENDPOINT - Create user with email "1" and password "1"
app.post('/api/admin/create-simple-user', async (req, res) => {
    try {
        const email = '1';
        const password = '1';
        const hashedPassword = await bcrypt.hash(password, 10);
        const username = 'user_' + Date.now();

        // Check if already exists
        const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.json({
                success: true,
                message: 'User already exists',
                user: { email, id: existing.rows[0].id }
            });
        }

        const result = await db.query(
            `INSERT INTO users (username, email, password_hash, role, balance, display_name, avatar_url) 
             VALUES ($1, $2, $3, 'user', 100, $4, 'https://via.placeholder.com/150') 
             RETURNING *`,
            [username, email, hashedPassword, 'User 1']
        );

        res.json({
            success: true,
            message: 'User created successfully',
            user: { email, id: result.rows[0].id }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ME (Token Verification)
app.get('/api/me', authenticateToken, (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        avatar_url: req.user.avatar_url,
        display_name: req.user.display_name
    });
});

// GET OPERATORS
app.get('/api/operators', async (req, res) => {
    try {
        const { gender } = req.query;
        console.log(`[DEBUG] Fetching operators list. Filter Gender: ${gender || 'none'}`);

        let query = `
            SELECT u.id, COALESCE(u.display_name, u.username) as name, u.avatar_url, u.gender, u.age, u.vip_level, o.category, o.rating, o.is_online, COALESCE(o.bio, u.bio) as bio, o.photos, u.role
            FROM users u
            JOIN operators o ON u.id = o.user_id
        `;

        let params = [];
        if (gender === 'erkek' || gender === 'kadin') {
            query += ` WHERE u.gender = $1 `;
            params.push(gender);
        }

        query += ` ORDER BY u.created_at DESC `;

        const result = await db.query(query, params);
        console.log(`[DEBUG] Found ${result.rows.length} operators in DB.`);

        const protocol = req.protocol;
        const host = req.get('host');

        const rows = result.rows.map(row => {
            const protocol = req.protocol;
            const host = req.get('host');

            // Process Avatar URL
            let finalAvatarUrl = row.avatar_url;
            if (finalAvatarUrl) {
                if (!finalAvatarUrl.startsWith('http')) {
                    finalAvatarUrl = `${protocol}://${host}${finalAvatarUrl.startsWith('/') ? '' : '/'}${finalAvatarUrl}`;
                } else if (finalAvatarUrl.includes('localhost:3000')) {
                    finalAvatarUrl = finalAvatarUrl.replace('localhost:3000', host);
                }
            } else {
                finalAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name)}&background=random&color=fff`;
            }

            // Process Photos Array
            const finalPhotos = (row.photos || []).map(photoUrl => {
                if (!photoUrl) return photoUrl;
                if (!photoUrl.startsWith('http')) {
                    return `${protocol}://${host}${photoUrl.startsWith('/') ? '' : '/'}${photoUrl}`;
                } else if (photoUrl.includes('localhost:3000')) {
                    return photoUrl.replace('localhost:3000', host);
                }
                return photoUrl;
            });

            return {
                ...row,
                avatar_url: finalAvatarUrl,
                photos: finalPhotos,
                gender: row.gender || 'kadin'
            };
        });

        res.json(rows);
    } catch (err) {
        console.error("Fetch Operators Error:", err.message);
        res.status(500).json({ error: err.message });
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

// HEALTH CHECK
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// UNIFIED DISCOVERY (Operators + Users of opposite gender)
app.get('/api/discovery', authenticateToken, async (req, res) => {
    try {
        const userGender = req.user.gender || 'erkek'; // Default to male if unknown
        const targetGender = userGender === 'kadin' ? 'erkek' : 'kadin';
        const userId = req.user.id;

        console.log(`[DISCOVERY] User ${userId} (${userGender}) exploring ${targetGender}...`);

        const query = `
                u.id, 
                COALESCE(u.display_name, u.username) as name, 
                u.avatar_url, 
                u.gender, 
                u.age, 
                u.vip_level, 
                u.role,
                o.category, 
                o.rating, 
                o.is_online, 
                COALESCE(o.bio, u.bio) as bio, 
                o.photos,
                CASE WHEN o.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_operator
            FROM users u
            LEFT JOIN operators o ON u.id = o.user_id
            WHERE u.gender = $1 
              AND u.role NOT IN ('admin', 'super_admin')
              AND u.id != $2
            ORDER BY o.is_online DESC, u.created_at DESC
        `;

        const result = await db.query(query, [targetGender, userId]);
        const protocol = req.protocol;
        const host = req.get('host');

        const rows = result.rows.map(row => {
            return sanitizeUser(row, req);
        });

        res.json(rows);
    } catch (err) {
        console.error("Discovery Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// CREATE OPERATOR (Admin Profile)
app.post('/api/operators', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { name, avatar_url, category, bio, photos, gender, age, vip_level } = req.body;

    try {
        await db.query('BEGIN');

        // Generate unique email and username to avoid collision
        const ts = Date.now();
        const uniqueEmail = `${name.toLowerCase().replace(/\s/g, '')}${ts}@falka.com`;
        const uniqueUsername = `${name}_${ts}`;

        // 1. Create a User entry for the operator
        // FIX: Provide legacy password for non-null constraint
        const userResult = await db.query(
            "INSERT INTO users (username, email, password, password_hash, role, avatar_url, gender, display_name, age, vip_level) VALUES ($1, $2, $3, $3, 'operator', $4, $5, $6, $7, $8) RETURNING id",
            [uniqueUsername, uniqueEmail, 'hashed_password', avatar_url, gender || 'kadin', name, age || 18, vip_level || 0]
        );

        const userId = userResult.rows[0].id;

        // 2. Create Operator entry
        await db.query(
            'INSERT INTO operators (user_id, category, bio, photos, is_online) VALUES ($1, $2, $3, $4, $5)',
            [userId, category, bio, photos || [], true]
        );

        await db.query('COMMIT');
        res.json({ success: true, userId });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Create Profile Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// UPDATE OPERATOR
app.put('/api/operators/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { id } = req.params;
    const { name, avatar_url, category, bio, photos, gender, age, vip_level } = req.body;

    try {
        await db.query('BEGIN');

        // 1. Update User table
        await db.query(
            'UPDATE users SET display_name = $1, avatar_url = $2, gender = $3, age = $4, vip_level = $5 WHERE id = $6',
            [name, avatar_url, gender, age || 18, vip_level || 0, id]
        );

        // 2. Update Operator table
        await db.query(
            'UPDATE operators SET category = $1, bio = $2, photos = $3 WHERE user_id = $4',
            [category, bio, photos || [], id]
        );

        await db.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Update Profile Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// START CHAT (Find or Create)
app.post('/api/chats', async (req, res) => {
    const { userId, operatorId } = req.body;
    try {
        // Check existing
        const existing = await db.query(
            'SELECT * FROM chats WHERE user_id = $1 AND operator_id = $2',
            [userId, operatorId]
        );
        if (existing.rows.length > 0) {
            return res.json(existing.rows[0]);
        }
        // Create new
        const newChat = await db.query(
            'INSERT INTO chats (user_id, operator_id) VALUES ($1, $2) RETURNING *',
            [userId, operatorId]
        );
        res.json(newChat.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET CHATS FOR USER
app.get('/api/users/:userId/chats', async (req, res) => {
    const { userId } = req.params;
    console.log(`GET /api/users/${userId}/chats requested`);
    try {
        const query = `
            SELECT 
                c.id, 
                op.username as name, 
                op.avatar_url, 
                op.is_online,
                (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT COUNT(*) FROM messages WHERE chat_id = c.id AND sender_id != $1 AND is_read = false) as unread_count
            FROM chats c
            JOIN users u_op ON c.operator_id = u_op.id
            JOIN operators op_details ON u_op.id = op_details.user_id 
            JOIN users op ON c.operator_id = op.id 
            WHERE c.user_id = $1
            ORDER BY c.last_message_at DESC
        `;
        // Simplified query to just get operator details
        // Simplified query to just get operator details
        const simpleQuery = `
            SELECT 
                c.id,
                c.operator_id, 
                c.last_message,
                c.last_message_at,
                c.unread_count,
                COALESCE(u.display_name, u.username, 'Bilinmeyen Operatör') as name, 
                COALESCE(u.avatar_url, 'https://via.placeholder.com/150') as avatar_url,
                true as is_online 
            FROM chats c
            LEFT JOIN users u ON c.operator_id = u.id
            WHERE c.user_id = $1
            ORDER BY c.last_message_at DESC
        `;

        const result = await db.query(simpleQuery, [userId]);

        const processedRows = result.rows.map(row => sanitizeUser(row, req));

        console.log(`GET /api/users/${userId}/chats - Found ${processedRows.length} chats`);
        res.json(processedRows);
    } catch (err) {
        console.error("Get User Chats Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET CHATS FOR ADMIN
app.get('/api/chats/admin', async (req, res) => {
    try {
        console.log('GET /api/chats/admin - Fetching chats...');
        const query = `
            SELECT 
                c.*, 
                COALESCE(u.display_name, u.username, 'Bilinmeyen Kullanıcı') as user_name, 
                u.avatar_url as user_avatar,
                COALESCE(op.display_name, op.username, 'Bilinmeyen Operatör') as operator_name, 
                op.avatar_url as operator_avatar,
                (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
            FROM chats c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN users op ON c.operator_id = op.id
            WHERE EXISTS (SELECT 1 FROM messages m WHERE m.chat_id = c.id)
            ORDER BY c.last_message_at DESC
        `;
        const result = await db.query(query);
        console.log(`GET /api/chats/admin - Found ${result.rows.length} chats.`);

        const sanitizedRows = result.rows.map(row => {
            // Sanitize both user and operator avatars
            const userPart = sanitizeUser({ avatar_url: row.user_avatar, display_name: row.user_name }, req);
            const operatorPart = sanitizeUser({ avatar_url: row.operator_avatar, display_name: row.operator_name }, req);
            return {
                ...row,
                user_avatar: userPart.avatar_url,
                operator_avatar: operatorPart.avatar_url
            };
        });

        res.json(sanitizedRows);
    } catch (err) {
        console.error('GET /api/chats/admin - ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET MESSAGES FOR A CHAT
app.get('/api/messages/:chatId', async (req, res) => {
    const { chatId } = req.params;
    try {
        const query = `
            SELECT m.*, COALESCE(u.display_name, u.username, 'Bilinmeyen Kullanıcı') as sender_name 
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = $1
            ORDER BY m.created_at ASC
        `;
        const result = await db.query(query, [chatId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- MODERATION API ---

// File Upload Endpoint with Optimization
app.post('/api/upload', upload.any(), async (req, res) => {
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
            // Append to array in operators table
            await db.query(
                'UPDATE operators SET photos = array_append(photos, $1) WHERE user_id = $2',
                [photo.url, photo.user_id]
            );
        }

        // Log Activity
        logActivity(photo.user_id, 'admin', `${photo.type === 'avatar' ? 'Profil' : 'Albüm'} fotoğrafı onaylandı.`);

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

        // STORAGE PROTECTION: Delete the file physically if rejected
        if (photo.url && photo.url.includes('/uploads/')) {
            const fileName = photo.url.split('/').pop();
            const filePath = path.join(__dirname, 'uploads', fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('Rejected photo deleted from storage:', fileName);
            }
        }

        logActivity(photo.user_id, 'admin', 'Fotoğrafı reddedildi.');
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
                WHERE id NOT IN (
                    SELECT id FROM activities 
                    ORDER BY created_at DESC 
                    LIMIT 500
                )
            `);
            res.json({ success: true, count: result.rowCount });
        } else if (type === 'orphaned_files') {
            // Complex orphaned file cleanup could be added here
            // For now, let's just clear rejected photos and their files
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
        logActivity(userId, 'vip_xp_purchase', `${coins} coin harcayarak ${coins} VIP XP kazandı.`);

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
const GIFT_PRICES = {
    1: 50,      // Gül
    2: 100,     // Kahve
    3: 250,     // Çikolata
    4: 500,     // Ayıcık
    5: 1000,    // Pırlanta
    6: 2000,    // Yarış Arabası
    7: 5000,    // Şato
    8: 10000,   // Helikopter
    9: 15000,   // Yat
    10: 20000   // Tac
};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join a specific chat room
    socket.on('join_room', (chatId) => {
        socket.join(chatId);
        console.log(`User ${socket.id} joined room ${chatId}`);
    });

    // Send Message
    socket.on('send_message', async (data) => {
        const { chatId, senderId, content, type, giftId } = data;
        let savedMsg = { ...data, id: Date.now() };

        try {
            // Check if sender is an operator (bypass coin cost for operators)
            const operatorCheck = await db.query('SELECT user_id FROM operators WHERE user_id = $1', [senderId]);
            const isOperator = operatorCheck.rows.length > 0;

            let cost = 0;
            let userBalance = 0;

            // Only charge coins if sender is NOT an operator
            if (!isOperator) {
                // Calculate Cost
                cost = 10; // Default text message cost
                if (type === 'gift' && giftId) {
                    cost = GIFT_PRICES[giftId] || 10;
                } else if (type === 'image') {
                    cost = 50;
                } else if (type === 'audio') {
                    cost = 30;
                }

                // 1. Check Balance
                const userResult = await db.query('SELECT balance FROM users WHERE id = $1', [senderId]);
                if (userResult.rows.length === 0) return;

                userBalance = userResult.rows[0].balance;

                if (userBalance < cost) {
                    // Insufficient funds
                    io.to(socket.id).emit('message_error', {
                        message: `Yetersiz bakiye. Bu işlem için ${cost} coin gerekli.`,
                        required: cost
                    });
                    return;
                }

                // 2. Deduct Coin
                await db.query('UPDATE users SET balance = balance - $2 WHERE id = $1', [senderId, cost]);

                // 3. Emit new balance
                io.to(socket.id).emit('balance_update', { newBalance: userBalance - cost });
            }

            // 4. Save Message
            // If gift, content might be the gift ID or a description. Let's use content passed from client.
            const res = await db.query(
                'INSERT INTO messages (chat_id, sender_id, content, content_type) VALUES ($1, $2, $3, $4) RETURNING *',
                [chatId, senderId, content, type || 'text']
            );
            savedMsg = res.rows[0];

            let lastMsgPreview = content;
            if (type === 'gift') lastMsgPreview = '🎁 Hediye Gönderildi';
            if (type === 'image') lastMsgPreview = '📷 Resim';
            if (type === 'audio') lastMsgPreview = '🎤 Ses Kaydı';

            await db.query('UPDATE chats SET last_message_at = NOW(), last_message = $2 WHERE id = $1', [chatId, lastMsgPreview]);

            // 5. Broadcast Message
            io.to(chatId).emit('receive_message', savedMsg);

        } catch (err) {
            console.error('DB Error:', err.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// MANUAL ADMIN CREATION: Chameleon Fix
app.get('/api/admin/force-create-admin', async (req, res) => {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };

    if (req.query.secret !== 'falka_fix_now') {
        return res.json({ status: 'error', message: 'Access Denied' });
    }

    try {
        log("⚠️ [MANUAL ADMIN] Starting Admin Creation/Reset...");

        // 1. Hash Password
        const hashedPassword = await bcrypt.hash('admin123', 10);
        log("✅ Password hashed.");

        // 2. Insert or Update Admin
        // We need to handle UUID vs INT for the ID return, but mostly we just care about inserting.
        // We will try to INSERT with ON CONFLICT DO UPDATE

        // Check if admin exists by email
        const check = await db.query("SELECT * FROM users WHERE email = 'admin@falka.com'");

        if (check.rows.length > 0) {
            log("ℹ️ Admin exists. Updating password...");
            await db.query("UPDATE users SET password_hash = $1, role = 'admin', account_status = 'active' WHERE email = 'admin@falka.com'", [hashedPassword]);
            log("✅ Admin updated.");
        } else {
            log("ℹ️ Creating new admin...");
            // We need to know if ID is SERIAL or UUID to know if we can rely on auto-gen
            // Actually, if we just INSERT without ID, the DB handles it.
            // But we need to match the columns.

            await db.query(`
                INSERT INTO users (username, email, password, password_hash, role, balance, account_status, display_name) 
                VALUES ($1, $2, $3, $3, 'admin', 0, 'active', 'Admin')
            `, ['admin', 'admin@falka.com', hashedPassword]);
            log("✅ Admin created.");
        }

        res.json({
            status: 'success',
            message: 'Admin user ready.',
            credentials: { email: 'admin@falka.com', password: 'admin123' },
            logs: logs
        });

    } catch (err) {
        log(`❌ [MANUAL ADMIN] Error: ${err.message}`);
        res.json({ status: 'error', error: err.message, logs: logs });
    }
});

// MANUAL EMERGENCY FIX V2: Chameleon Fix (UUID/INT Adaptive)
app.get('/api/admin/force-fix-schema-v2', async (req, res) => {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };

    // 1. Basic security check
    if (req.query.secret !== 'falka_fix_now') {
        return res.json({ status: 'error', message: 'Access Denied', logs });
    }

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

// Global Error Handler for Multer/Other
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [BACKEND] Server listening on http://0.0.0.0:${PORT}`);
    console.log(`📡 [BACKEND] Accessible on http://localhost:${PORT}`);
});
