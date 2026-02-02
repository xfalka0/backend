const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();
const bcrypt = require('bcrypt');
const { authenticateToken, authorizeRole, SECRET_KEY } = require('./middleware/auth');
const jwt = require('jsonwebtoken');

const app = express();
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');

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
        console.log('Multer: Saving to', uploadsDir);
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const fname = Date.now() + path.extname(file.originalname);
        console.log('Multer: Generated filename', fname);
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
app.use('/uploads', express.static('uploads'));
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));

// Serve Admin Panel index.html for unknown /admin routes (SPA support)
app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin', 'index.html'));
});

// --- REST API ROUTES ---

// GET USER PROFILE
app.get('/api/users/:id', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER PROFILE
app.put('/api/users/:id/profile', async (req, res) => {
    const { id } = req.params;
    const { display_name } = req.body;
    try {
        const result = await db.query(
            'UPDATE users SET display_name = $1 WHERE id = $2 RETURNING *',
            [display_name, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auto-Migration: Ensure necessary columns exist
(async () => {
    try {
        console.log('🔄 [MIGRATION] Checking database connection and schema...');

        // 1. Create Base Tables (Bootstrap)
        await db.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
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

        await db.query(`CREATE TABLE IF NOT EXISTS operators (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            image TEXT,
            is_online BOOLEAN DEFAULT TRUE,
            job VARCHAR(100)
        )`);

        await db.query(`CREATE TABLE IF NOT EXISTS chats (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            operator_id INTEGER REFERENCES operators(id),
            last_message TEXT,
            unread_count INTEGER DEFAULT 0,
            last_message_at TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        await db.query(`CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            chat_id INTEGER REFERENCES chats(id),
            sender_id INTEGER,
            content TEXT,
            content_type VARCHAR(50) DEFAULT 'text',
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        await db.query(`CREATE TABLE IF NOT EXISTS pending_photos (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            photo_url TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        // 2. Apply Alterations (For existing local DBs that might lack new columns)
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(10) DEFAULT 'kadin'`);
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)`);
        await db.query(`ALTER TABLE operators ADD COLUMN IF NOT EXISTS job VARCHAR(100)`);

        // Chats table migration
        await db.query(`ALTER TABLE chats ADD COLUMN IF NOT EXISTS last_message TEXT`);
        await db.query(`ALTER TABLE chats ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0`);

        // VIP System migration
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10, 2) DEFAULT 0`);
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_level INTEGER DEFAULT 0`);

        // Report & Block System migration
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'active'`);
        await db.query(`CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            reporter_id INTEGER,
            reported_id INTEGER,
            reason TEXT,
            details TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )`);
        await db.query(`CREATE TABLE IF NOT EXISTS blocks (
            id SERIAL PRIMARY KEY,
            blocker_id INTEGER,
            blocked_id INTEGER,
            created_at TIMESTAMP DEFAULT NOW()
        )`);

        // Try to relax password constraint if it exists
        try {
            await db.query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL`);
        } catch (e) {
            // Ignore if column doesn't exist or other error
        }

        console.log('✅ [MIGRATION] Schema check/update successfully.');
    } catch (err) {
        console.error('❌ [MIGRATION] CRITICAL ERROR:', err.message);
        console.error('Check if database "dating" exists and postgres user has permissions.');
    }
})();

// Health Check
app.get('/', (req, res) => {
    res.send('Chat System Backend is Running');
});

// ... (existing routes) ...

// --- ADMIN USER MANAGEMENT ---

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
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()"
        ];

        for (const query of migrations) {
            try {
                await db.query(query);
            } catch (migErr) {
                console.warn(`Migration step failed: ${query}`, migErr.message);
            }
        }

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
            // FIX: Include 'password' column (legacy) to satisfy potential NOT NULL constraint
            await db.query(
                "INSERT INTO users (username, email, password, password_hash, role, balance, account_status) VALUES ($1, $2, $3, $3, 'admin', 0, 'active')",
                ['admin', 'admin@falka.com', hashedPassword]
            );
            res.send('<h1>Success!</h1><p>Database columns repaired.</p><p>Admin user created.</p><p>Login: admin@falka.com / admin123</p>');
        } else {
            await db.query("UPDATE users SET password_hash = $1, role = 'admin', account_status = 'active', email = 'admin@falka.com' WHERE username = 'admin'", [hashedPassword]);
            res.send('<h1>Success!</h1><p>Database columns repaired.</p><p>Admin user verified and updated.</p><p>Login: admin@falka.com / admin123</p>');
        }

    } catch (err) {
        console.error("Setup Error:", err);
        res.status(500).send(`<h1>Error</h1><p>${err.message}</p><pre>${JSON.stringify(err, null, 2)}</pre>`);
    }
});

// GET ALL USERS (Manager/Admin Only)
app.get('/api/admin/users', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query('SELECT id, username, email, role, account_status, created_at, last_login_at FROM users ORDER BY created_at DESC');
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

// ... (existing routes) ...

// SIMULATED PURCHASE (Update VIP & Balance)
app.post('/api/purchase', async (req, res) => {
    const { userId, amount, coins } = req.body;
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

        // 4. Update Database
        await db.query(
            'UPDATE users SET total_spent = $1, vip_level = $2, balance = $3 WHERE id = $4',
            [newTotal, newVipLevel, newBalance, userId]
        );

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

// REGISTER
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Check if user exists
        const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Email already in use' });
        }

        // Create User
        // Note: In production use bcrypt for passwords!
        const newUser = await db.query(
            "INSERT INTO users (username, email, password, password_hash, role, balance, avatar_url) VALUES ($1, $2, $3, $3, 'user', 100, 'https://via.placeholder.com/150') RETURNING *",
            [email.split('@')[0], email, password]
        );

        res.json({ user: newUser.rows[0], token: 'fake-jwt-token' });
    } catch (err) {
        console.error("Registration Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// LOGIN
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Kullanıcı bulunamadı veya şifre yanlış.' });
        }

        const user = result.rows[0];

        // Verify Password
        // Note: For existing plain text passwords in dev, you might want a fallback or reset DB.
        // Assuming new users or admin created via script will have hashed passwords.
        // For dev purposes, if password doesn't start with $2b$, compare plain text (TEMPORARY FIX FOR DEV)
        let validPassword = false;
        if (user.password_hash && user.password_hash.startsWith('$2b$')) {
            validPassword = await bcrypt.compare(password, user.password_hash);
        } else if (user.password) { // Fallback to legacy password
            validPassword = (password === user.password);
        }

        if (!validPassword) {
            return res.status(401).json({ error: 'Kullanıcı bulunamadı veya şifre yanlış.' });
        }

        if (user.account_status !== 'active') {
            return res.status(403).json({ error: 'Hesabınız askıya alınmış.' });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                avatar_url: user.avatar_url,
                display_name: user.display_name
            },
            token
        });

    } catch (err) {
        console.error("Login Error:", err.message);
        res.status(500).json({ error: err.message });
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
        const query = `
      SELECT u.id, COALESCE(u.display_name, u.username) as name, u.avatar_url, u.gender, o.category, o.rating, o.is_online, o.bio, o.photos, u.role
      FROM users u
      JOIN operators o ON u.id = o.user_id
      ORDER BY u.created_at DESC
    `;
        const result = await db.query(query);

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

// CREATE OPERATOR (Admin Profile)
app.post('/api/operators', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { name, avatar_url, category, bio, photos, gender } = req.body;

    try {
        await db.query('BEGIN');

        // Generate unique email and username to avoid collision
        const ts = Date.now();
        const uniqueEmail = `${name.toLowerCase().replace(/\s/g, '')}${ts}@falka.com`;
        const uniqueUsername = `${name}_${ts}`;

        // 1. Create a User entry for the operator
        // FIX: Provide legacy password for non-null constraint
        const userResult = await db.query(
            "INSERT INTO users (username, email, password, password_hash, role, avatar_url, gender, display_name) VALUES ($1, $2, $3, $3, 'operator', $4, $5, $6) RETURNING id",
            [uniqueUsername, uniqueEmail, 'hashed_password', avatar_url, gender || 'kadin', name]
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
    const { name, avatar_url, category, bio, photos, gender } = req.body;

    try {
        await db.query('BEGIN');

        // 1. Update User table
        await db.query(
            'UPDATE users SET display_name = $1, avatar_url = $2, gender = $3 WHERE id = $4',
            [name, avatar_url, gender, id]
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

        const protocol = req.protocol;
        const host = req.get('host');
        console.log(`[DEBUG] Request Host: ${host}`);

        const processedRows = result.rows.map(row => {
            let finalAvatarUrl = row.avatar_url;
            const originalUrl = finalAvatarUrl; // Log original

            if (finalAvatarUrl && !finalAvatarUrl.startsWith('http')) {
                finalAvatarUrl = `http://${SERVER_IP}:${PORT}${finalAvatarUrl.startsWith('/') ? '' : '/'}${finalAvatarUrl}`;
            } else if (finalAvatarUrl && finalAvatarUrl.includes('localhost:3000')) {
                finalAvatarUrl = finalAvatarUrl.replace('localhost:3000', `${SERVER_IP}:${PORT}`);
            }

            if (originalUrl !== finalAvatarUrl) {
                console.log(`[DEBUG] ID: ${row.id} - URL Rewrote: ${originalUrl} -> ${finalAvatarUrl}`);
            } else {
                console.log(`[DEBUG] ID: ${row.id} - URL Kept: ${originalUrl}`);
            }

            return {
                ...row,
                avatar_url: finalAvatarUrl
            };
        });

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
        res.json(result.rows);
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

// File Upload Endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
    console.log('Upload request received');
    if (!req.file) {
        console.log('No file in request');
        return res.status(400).json({ error: 'No file uploaded' });
    }
    console.log('File uploaded:', req.file.filename);

    // Return relative path to be more flexible
    const relativePath = `/uploads/${req.file.filename}`;

    // Also provide an absolute URL for convenience using the request's host
    const protocol = req.protocol;
    const host = req.get('host');
    const url = `${protocol}://${host}${relativePath}`;

    res.json({ url, relativePath });
});

// Submit a photo for moderation
app.post('/api/moderation/submit', async (req, res) => {
    const { userId, type, url } = req.body; // type: 'avatar' or 'album'
    try {
        const result = await db.query(
            'INSERT INTO pending_photos (user_id, type, url) VALUES ($1, $2, $3) RETURNING *',
            [userId, type, url]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
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

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reject a photo
app.post('/api/moderation/reject', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { photoId } = req.body;
    try {
        await db.query('UPDATE pending_photos SET status = \'rejected\' WHERE id = $1', [photoId]);
        res.json({ success: true });
    } catch (err) {
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
            // Calculate Cost
            let cost = 10; // Default text message cost
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

            const userBalance = userResult.rows[0].balance;

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
