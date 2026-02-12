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
const jwt = require('jsonwebtoken');
const socialRoutes = require('./routes/socialRoutes');
const authRoutes = require('./routes/authRoutes');
const { sanitizeUser, logActivity } = require('./utils/helpers');

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

        if (!columnNames.includes('relationship')) {
            console.log('[DB] Adding missing column: relationship');
            await db.query('ALTER TABLE users ADD COLUMN relationship VARCHAR(50)');
        }

        if (!columnNames.includes('zodiac')) {
            console.log('[DB] Adding missing column: zodiac');
            await db.query('ALTER TABLE users ADD COLUMN zodiac VARCHAR(50)');
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

        if (!columnNames.includes('account_status')) {
            console.log('[DB] Adding missing column: account_status');
            await db.query("ALTER TABLE users ADD COLUMN account_status VARCHAR(50) DEFAULT 'active'");
        }

        // Detect users.id type to ensure FK compatibility
        let userIdType = 'UUID';
        const userTypeCheck = await db.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id'");
        if (userTypeCheck.rows.length > 0) {
            userIdType = userTypeCheck.rows[0].data_type.toUpperCase() === 'INTEGER' ? 'INTEGER' : 'UUID';
            console.log(`[DB] Detected users.id type: ${userIdType}`);
        }

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

        // Migration logic
        // Messages table enhancements
        await db.query('ALTER TABLE messages ADD COLUMN IF NOT EXISTS gift_id INT');

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

        console.log('[DB] SCHEMA VERIFICATION COMPLETE');
        if (!app.get('db_status')) app.set('db_status', 'ready');
    } catch (err) {
        console.error('[DB] CRITICAL SCHEMA ERROR:', err.message);
        app.set('db_status', 'error: ' + err.message);
    }
};
initializeDatabase();

// --- DIAGNOSTIC ENDPOINT ---
app.get('/api/health-check', async (req, res) => {
    try {
        const dbCheck = await db.query('SELECT NOW()');
        const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");

        // Detailed column info for users and posts
        const userCols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
        const postCols = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'posts'");

        res.json({
            status: 'online',
            db: 'connected',
            db_time: dbCheck.rows[0].now,
            db_status: app.get('db_status'),
            tables: tables.rows.map(t => t.table_name),
            schema_info: {
                users: userCols.rows,
                posts: postCols.rows
            },
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
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});
app.set('io', io);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));
app.use('/api', socialRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes); // Proxy for /api/me /api/login etc

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
    const { display_name, name, bio, avatar_url, gender, interests, onboarding_completed, relationship, zodiac, age } = req.body;

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
                job = COALESCE($11, job)
             WHERE id = $12 RETURNING *`,
            [
                req.body.display_name || null,
                req.body.name || null,
                req.body.bio || null,
                req.body.avatar_url || null,
                req.body.gender || null,
                req.body.interests || null,
                req.body.onboarding_completed !== undefined ? req.body.onboarding_completed : null,
                (req.body.age && !isNaN(parseInt(req.body.age))) ? parseInt(req.body.age) : null,
                req.body.relationship || null,
                req.body.zodiac || null,
                req.body.job || null,
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
        console.log(`[ADMIN] Fetching users list for admin: ${req.user.id}`);
        const result = await db.query(`
            SELECT id, username, email, role, account_status, balance, 
                   is_vip, created_at, last_login_at, ban_expires_at, avatar_url 
            FROM users 
            WHERE role = 'user' 
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
            'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance',
            [amount, id]
        );

        // Log transaction
        await db.query(
            'INSERT INTO transactions (user_id, amount, package_name, status) VALUES ($1, $2, $3, $4)',
            [id, amount, amount > 0 ? 'Admin Ekleme' : 'Admin Ceza', 'completed']
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
            const email = identifier;
            const username = email ? email.split('@')[0] : `user_${Math.floor(1000 + Math.random() * 9000)}`;
            const insertResult = await db.query(
                "INSERT INTO users (username, email, role, balance, avatar_url, display_name) VALUES ($1, $2, 'user', 100, 'https://via.placeholder.com/150', $3) RETURNING *",
                [username, email || null, username]
            );
            user = insertResult.rows[0];
            await logActivity(io, user.id, 'register', 'Yeni kullanıcı OTP ile kayıt oldu.');
            if (io) io.emit('new_user', sanitizeUser(user, req));
        } else {
            // Login Existing User
            user = result.rows[0];
            await logActivity(io, user.id, 'login', 'Kullanıcı OTP ile giriş yaptı.');
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
            SELECT u.id, COALESCE(u.display_name, u.username) as name, u.avatar_url, u.gender, u.age, u.vip_level, o.category, o.rating, o.is_online, COALESCE(o.bio, u.bio) as bio, o.photos, u.role,
            EXISTS(SELECT 1 FROM stories s WHERE s.operator_id = u.id AND s.expires_at > NOW()) as has_active_story
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

// UNIFIED DISCOVERY (Operators + Users of opposite gender)
app.get('/api/discovery', authenticateToken, async (req, res) => {
    try {
        const userGender = req.user.gender || 'erkek'; // Default to male if unknown
        const targetGender = userGender === 'kadin' ? 'erkek' : 'kadin';
        const userId = req.user.id;

        console.log(`[DISCOVERY] User ${userId} (${userGender}) exploring ${targetGender}...`);

        const query = `
            SELECT 
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
                CASE WHEN o.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_operator,
                EXISTS(SELECT 1 FROM stories s WHERE s.operator_id = u.id AND s.expires_at > NOW()) as has_active_story
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
                c.last_message_at,
                (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT COUNT(*)::int FROM messages WHERE chat_id = c.id AND sender_id != $1 AND is_read = false) as unread_count,
                COALESCE(u.display_name, u.username, 'Bilinmeyen Operatör') as name, 
                COALESCE(u.avatar_url, 'https://via.placeholder.com/150') as avatar_url,
                u.vip_level,
                u.is_verified,
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


// CREATE OR GET CHAT
app.post('/api/chats', async (req, res) => {
    const { userId, operatorId } = req.body;
    try {
        // 1. Check if chat exists
        const existingChat = await db.query(
            'SELECT * FROM chats WHERE user_id = $1 AND operator_id = $2',
            [userId, operatorId]
        );

        if (existingChat.rows.length > 0) {
            return res.json(existingChat.rows[0]);
        }

        // 2. Create new chat
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

// GET CHATS FOR ADMIN
app.get('/api/chats/admin', async (req, res) => {
    try {
        console.log('GET /api/chats/admin - Fetching chats...');
        const query = `
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

// SEND MESSAGE VIA HTTP (for automated messages)
app.post('/api/messages', async (req, res) => {
    const { chatId, senderId, content, type } = req.body;
    try {
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

                // 3. Emit new balance (include userId for client sync)
                io.to(socket.id).emit('balance_update', {
                    id: senderId,
                    userId: senderId,
                    newBalance: userBalance - cost
                });
            }

            // 4. Save Message
            const res = await db.query(
                'INSERT INTO messages (chat_id, sender_id, content, content_type, gift_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [chatId, senderId, content, type || 'text', giftId || null]
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

// SOCIAL SCHEMA REPAIR: Fix for 500 Errors
app.get('/api/admin/force-fix-social-schema', async (req, res) => {
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };

    if (req.query.secret !== 'falka_fix_now') {
        return res.json({ status: 'error', message: 'Access Denied', logs });
    }

    try {
        log("⚠️ [SOCIAL REPAIR] Starting Granular Social Schema Repair...");

        // 1. Extensions
        try {
            await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
            log("✅ [1] pgcrypto extension checked/added.");
        } catch (e) { log(`❌ [1] pgcrypto failed: ${e.message}`); }

        // 2. Clear corrupted tables
        try {
            log("ℹ️ [2] Dropping social tables (Stories)...");
            await db.query('DROP TABLE IF EXISTS stories CASCADE');
            log("✅ [2] Stories dropped.");

            log("ℹ️ [2] Dropping social tables (Posts)...");
            await db.query('DROP TABLE IF EXISTS posts CASCADE');
            log("✅ [2] Posts dropped.");
        } catch (e) { log(`❌ [2] Drop failed: ${e.message}`); }

        // 3. DETECT USERS ID TYPE (Again, just to be ABSOLUTELY sure)
        let userIdType = 'UUID';
        try {
            const userTypeCheck = await db.query(`
                SELECT data_type 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'id'
            `);
            if (userTypeCheck.rows.length > 0) {
                userIdType = userTypeCheck.rows[0].data_type.toUpperCase() === 'INTEGER' ? 'INTEGER' : 'UUID';
                log(`ℹ️ [3] Detected users.id type: ${userIdType}`);
            }
        } catch (e) { log(`❌ [3] Type detection failed: ${e.message}`); }

        // 4. Create Posts
        try {
            log("ℹ️ [4] Creating Posts table...");
            await db.query(`CREATE TABLE posts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                operator_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
                image_url TEXT NOT NULL,
                content TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )`);
            log("✅ [4] Posts table created successfully.");
        } catch (e) { log(`❌ [4] Posts creation failed: ${e.message}`); }

        // 5. Create Stories
        try {
            log("ℹ️ [5] Creating Stories table...");
            await db.query(`CREATE TABLE stories (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                operator_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
                image_url TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
            )`);
            log("✅ [5] Stories table created successfully.");
        } catch (e) { log(`❌ [5] Stories creation failed: ${e.message}`); }

        // 6. Create post_likes
        try {
            log("ℹ️ [6] Creating post_likes table...");
            await db.query(`CREATE TABLE post_likes (
                post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
                user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                PRIMARY KEY (post_id, user_id)
            )`);
            log("✅ [6] post_likes table created successfully.");
        } catch (e) { log(`❌ [6] post_likes creation failed: ${e.message}`); }

        res.json({
            status: 'complete',
            message: 'Social schema repair attempt finished.',
            logs: logs,
            final_id_type_used: userIdType
        });

    } catch (err) {
        log(`❌ [CRITICAL] Social Repair failed: ${err.message}`);
        res.json({ status: 'error', error: err.message, logs: logs });
    }
});

// Global Error Handler for Multer/Other
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// KEEP ALIVE ENDPOINT
app.get('/api/keep-alive', (req, res) => {
    res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// SELF PINGER TO PREVENT RENDER SLEEP (Every 14 minutes)
const startPinger = () => {
    const PING_INTERVAL = 14 * 60 * 1000; // 14 mins
    const URL = 'https://backend-kj17.onrender.com/api/keep-alive';

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [BACKEND] Server listening on http://0.0.0.0:${PORT}`);
    console.log(`📡 [BACKEND] Accessible on http://localhost:${PORT}`);
    startPinger();
});
