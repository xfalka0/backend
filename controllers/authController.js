const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { sanitizeUser, logActivity } = require('../utils/helpers');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '46669084263-drv76chuoahgvfitcdmctvvqm3cbudl7.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const SECRET_KEY = process.env.JWT_SECRET || 'falka_super_secret_2024_key_change_me';

// Google Auth
exports.googleAuth = async (req, res) => {
    const { idToken } = req.body;
    const io = req.app.get('io');
    if (!idToken) return res.status(400).json({ error: 'Token gerekli.' });

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name, picture } = payload;

        let userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        let user;

        if (userResult.rows.length === 0) {
            const username = email.split('@')[0] + '_' + Math.floor(Math.random() * 10000);
            const result = await db.query(
                `INSERT INTO users (username, email, display_name, avatar_url, role, balance) 
                 VALUES ($1, $2, $3, $4, 'user', 100) 
                 RETURNING *`,
                [username, email, name, picture || 'https://via.placeholder.com/150']
            );
            user = result.rows[0];
            await logActivity(io, user.id, 'register', 'Kullanıcı Google ile kayıt oldu.');
            if (io) io.emit('new_user', sanitizeUser(user, req));
        } else {
            user = userResult.rows[0];
            if (user.account_status !== 'active') {
                return res.status(403).json({ error: 'Hesabınız askıya alınmış.' });
            }
            await logActivity(io, user.id, 'login', 'Kullanıcı Google ile giriş yaptı.');
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, display_name: user.display_name, avatar_url: user.avatar_url },
            SECRET_KEY,
            { expiresIn: '30d' }
        );

        res.json({ user: sanitizeUser(user, req), token });
    } catch (error) {
        console.error('[GOOGLE_AUTH_ERROR]:', error.message);
        res.status(401).json({ error: 'Google doğrulaması başarısız.' });
    }
};

// Register Email
exports.registerEmail = async (req, res) => {
    const { email, password, username, display_name } = req.body;
    const io = req.app.get('io');
    if (!email || !password) return res.status(400).json({ error: 'Email ve şifre zorunludur.' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const finalUsername = username || email.split('@')[0] + '_' + Math.floor(Math.random() * 1000);

        const result = await db.query(
            "INSERT INTO users (username, email, password_hash, role, balance, display_name, avatar_url) VALUES ($1, $2, $3, 'user', 100, $4, 'https://via.placeholder.com/150') RETURNING *",
            [finalUsername, email, hashedPassword, display_name || finalUsername]
        );

        const user = result.rows[0];
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, display_name: user.display_name, avatar_url: user.avatar_url },
            SECRET_KEY,
            { expiresIn: '30d' }
        );

        await logActivity(io, user.id, 'register', 'Yeni kullanıcı e-posta ile kayıt oldu.');
        if (io) io.emit('new_user', sanitizeUser(user, req));
        res.status(201).json({ user: sanitizeUser(user, req), token });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanımda.' });
        res.status(500).json({ error: err.message });
    }
};

// Login Email
exports.loginEmail = async (req, res) => {
    const { email, password } = req.body;
    const io = req.app.get('io');

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
        }

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash || user.password);
        if (!valid) {
            return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
        }

        if (user.account_status !== 'active') {
            return res.status(403).json({ error: 'Hesabınız askıya alınmış.' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, display_name: user.display_name, avatar_url: user.avatar_url },
            SECRET_KEY,
            { expiresIn: '30d' }
        );

        await logActivity(io, user.id, 'login', 'Kullanıcı e-posta ile giriş yaptı.');
        res.json({ user: sanitizeUser(user, req), token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Me (Token Verification)
exports.getMe = (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        avatar_url: req.user.avatar_url,
        display_name: req.user.display_name,
        onboarding_completed: req.user.onboarding_completed
    });
};
