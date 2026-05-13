const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { sanitizeUser, logActivity, assignFakeInteractions, triggerAutoEngagement, triggerLoginAutoEngagement } = require('../utils/helpers');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '46669084263-drv76chuoahgvfitcdmctvvqm3cbudl7.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const SECRET_KEY = process.env.JWT_SECRET || 'falka_super_secret_2024_key_change_me';

// Google Auth
exports.googleAuth = async (req, res) => {
    const { idToken, deviceId, referralCode } = req.body;
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
            // Check device limit for NEW account
            if (deviceId) {
                const limitCheck = await db.query('SELECT count(*) FROM users WHERE device_id = $1', [deviceId]);
                if (parseInt(limitCheck.rows[0].count, 10) >= 2) {
                    return res.status(403).json({ error: 'Bu cihazdan en fazla 2 hesap oluşturulabilir veya kullanılabilir.' });
                }
            }

            // Handle Referral Code
            let referredBy = null;
            let finalReferralCode = referralCode;

            // If no code provided, try IP matching
            if (!finalReferralCode) {
                const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
                const matchRes = await db.query(
                    "SELECT code FROM referral_clicks WHERE ip = $1 AND created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC LIMIT 1",
                    [ip]
                );
                if (matchRes.rows.length > 0) {
                    finalReferralCode = matchRes.rows[0].code;
                    console.log(`[REFERRAL] Auto-matched via IP: ${ip} -> ${finalReferralCode}`);
                }
            }

            if (finalReferralCode) {
                const referrerRes = await db.query('SELECT id FROM users WHERE referral_code = $1', [finalReferralCode.toUpperCase()]);
                if (referrerRes.rows.length > 0) {
                    referredBy = referrerRes.rows[0].id;
                    console.log(`[REFERRAL] User referred by: ${finalReferralCode} (${referredBy})`);
                }
            }

            const username = email.split('@')[0] + '_' + Math.floor(Math.random() * 10000);
            const result = await db.query(
                `INSERT INTO users (username, email, display_name, avatar_url, role, balance, device_id, referred_by) 
                 VALUES ($1, $2, $3, $4, 'user', 100, $5, $6) 
                 RETURNING *`,
                [username, email, name, picture || 'https://via.placeholder.com/150', deviceId || null, referredBy]
            );
            user = result.rows[0];
            await assignFakeInteractions(user.id);
            await triggerAutoEngagement(io, user.id);
            await logActivity(io, user.id, 'register', 'Kullanıcı Google ile kayıt oldu.');
            if (io) io.emit('new_user', sanitizeUser(user, req));
        } else {
            user = userResult.rows[0];
            if (user.account_status !== 'active') {
                return res.status(403).json({ error: 'Hesabınız askıya alınmış.' });
            }

            // Check device limit if switching to a new device
            if (deviceId && user.device_id !== deviceId) {
                const limitCheck = await db.query('SELECT count(*) FROM users WHERE device_id = $1 AND id != $2', [deviceId, user.id]);
                if (parseInt(limitCheck.rows[0].count, 10) >= 2) {
                    return res.status(403).json({ error: 'Bu cihazdan en fazla 2 hesap oluşturulabilir veya kullanılabilir.' });
                }
                // Update device_id
                await db.query('UPDATE users SET device_id = $1 WHERE id = $2', [deviceId, user.id]);
                user.device_id = deviceId;
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
        console.error('------- [GOOGLE_AUTH_ERROR_DETAILS] -------');
        console.error('Error Message:', error.message);
        console.error('Provided Token:', idToken.substring(0, 20) + '...');
        console.error('Backend Client ID:', GOOGLE_CLIENT_ID);
        console.error('------------------------------------------');
        res.status(401).json({ error: 'Google doğrulaması başarısız.', details: error.message });
    }
};

// Register Email
exports.registerEmail = async (req, res) => {
    const { email, password, username, display_name, deviceId } = req.body;
    const io = req.app.get('io');
    if (!email || !password) return res.status(400).json({ error: 'Email ve şifre zorunludur.' });

    try {
        if (deviceId) {
            const limitCheck = await db.query('SELECT count(*) FROM users WHERE device_id = $1', [deviceId]);
            if (parseInt(limitCheck.rows[0].count, 10) >= 2) {
                return res.status(403).json({ error: 'Bu cihazdan en fazla 2 hesap oluşturulabilir veya kullanılabilir.' });
            }
        }

        const { referralCode } = req.body;
        let referredBy = null;
        let finalReferralCode = referralCode;

        // If no code provided, try IP matching
        if (!finalReferralCode) {
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const matchRes = await db.query(
                "SELECT code FROM referral_clicks WHERE ip = $1 AND created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC LIMIT 1",
                [ip]
            );
            if (matchRes.rows.length > 0) {
                finalReferralCode = matchRes.rows[0].code;
                console.log(`[REFERRAL] Auto-matched via IP: ${ip} -> ${finalReferralCode}`);
            }
        }

        if (finalReferralCode) {
            const referrerRes = await db.query('SELECT id FROM users WHERE referral_code = $1', [finalReferralCode.toUpperCase()]);
            if (referrerRes.rows.length > 0) {
                referredBy = referrerRes.rows[0].id;
                console.log(`[REFERRAL] User referred by: ${finalReferralCode} (${referredBy})`);
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const finalUsername = username || email.split('@')[0] + '_' + Math.floor(Math.random() * 1000);

        const result = await db.query(
            "INSERT INTO users (username, email, password_hash, role, balance, display_name, avatar_url, device_id, referred_by) VALUES ($1, $2, $3, 'user', 100, $4, 'https://via.placeholder.com/150', $5, $6) RETURNING *",
            [finalUsername, email, hashedPassword, display_name || finalUsername, deviceId || null, referredBy]
        );

        const user = result.rows[0];
        await assignFakeInteractions(user.id);
        await triggerAutoEngagement(io, user.id);

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
    const { email, password, deviceId } = req.body;
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

        if (deviceId && user.device_id !== deviceId) {
            const limitCheck = await db.query('SELECT count(*) FROM users WHERE device_id = $1 AND id != $2', [deviceId, user.id]);
            if (parseInt(limitCheck.rows[0].count, 10) >= 2) {
                return res.status(403).json({ error: 'Bu cihazdan en fazla 2 hesap oluşturulabilir veya kullanılabilir.' });
            }
            await db.query('UPDATE users SET device_id = $1 WHERE id = $2', [deviceId, user.id]);
            user.device_id = deviceId;
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
exports.getMe = async (req, res) => {
    const io = req.app.get('io');
    try {
        const userRes = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        
        const user = userRes.rows[0];

        if (user.role === 'user') {
            const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
            const lastAuto = user.last_auto_message_at ? new Date(user.last_auto_message_at).getTime() : 0;

            if (lastAuto < twelveHoursAgo) {
                await db.query('UPDATE users SET last_auto_message_at = NOW() WHERE id = $1', [user.id]);
                triggerLoginAutoEngagement(io, user.id);
            }
        }

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            avatar_url: user.avatar_url,
            display_name: user.display_name,
            referral_code: user.referral_code,
            onboarding_completed: user.onboarding_completed
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
