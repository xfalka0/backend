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

    const getClientIp = (req) => {
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) return forwarded.split(',')[0].trim();
        return req.socket.remoteAddress;
    };

    if (!idToken) return res.status(400).json({ error: 'Token gerekli.' });

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name, picture } = payload;
        const normalizedEmail = email ? email.trim().toLowerCase() : '';

        let userResult = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
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
                const ip = getClientIp(req);
                console.log(`[REFERRAL_DEBUG] Checking IP match for: ${ip}`);
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
                [username, normalizedEmail || null, name, picture || 'https://via.placeholder.com/150', deviceId || null, referredBy]
            );
            user = result.rows[0];

            // REFERRAL REWARD LOGIC
            if (referredBy) {
                try {
                    let fraudDetected = false;
                    if (deviceId) {
                        const refUserRes = await db.query('SELECT device_id FROM users WHERE id = $1', [referredBy]);
                        if (refUserRes.rows.length > 0 && refUserRes.rows[0].device_id === deviceId) {
                            fraudDetected = true;
                            console.log(`[REFERRAL_FRAUD] User ${user.id} and Referrer ${referredBy} share same device_id: ${deviceId}`);
                        }
                    }

                    if (!fraudDetected) {
                        await db.query('UPDATE users SET balance = balance + 500 WHERE id = $1', [referredBy]);
                        await db.query("INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)", 
                            [referredBy, 500, 'referral_bonus', 'Davet ettiğiniz kullanıcı kayıt oldu']);
                        
                        await db.query('UPDATE users SET balance = balance + 500 WHERE id = $1', [user.id]);
                        await db.query("INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)", 
                            [user.id, 500, 'referral_bonus', 'Davet kodu ile kayıt olma bonusu']);
                        user.balance += 500;

                        await db.query('INSERT INTO referral_rewards (referrer_id, referred_id, reward_type, amount) VALUES ($1, $2, $3, $4)',
                            [referredBy, user.id, 'registration', 500]);

                        if (io) {
                            db.query("INSERT INTO notifications (user_id, type, body) VALUES ($1, $2, $3) RETURNING *",
                                [referredBy, 'system', 'Tebrikler! Davet ettiğin bir arkadaşın kayıt oldu ve 500 Coin kazandın!']
                            ).then(notif => {
                                io.emit('new_notification', notif.rows[0]);
                                io.emit('balance_update', { userId: referredBy, newBalance: null });
                            }).catch(console.error);
                        }
                    }
                } catch (refErr) {
                    console.error('[REFERRAL_REWARD_ERROR]', refErr);
                }
            }

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
            { id: user.id, username: user.username, role: user.role, display_name: user.display_name, avatar_url: user.avatar_url, gender: user.gender },
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

// Register User (Phase 1)
exports.registerEmail = async (req, res) => {
    let { email, phone, password, username, displayName, display_name, gender, country, avatarUrl, avatar_url, bio, deviceId } = req.body;
    const io = req.app.get('io');
    
    if (!email && !phone) return res.status(400).json({ error: 'E-posta veya telefon numarası zorunludur.' });
    if (!username) return res.status(400).json({ error: 'Kullanıcı adı zorunludur.' });

    const normalizedEmail = email ? email.trim().toLowerCase() : null;
    const finalDisplayName = displayName || display_name || username;
    const finalAvatarUrl = avatarUrl || avatar_url || 'https://via.placeholder.com/150';

    try {
        if (deviceId) {
            const limitCheck = await db.query('SELECT count(*) FROM users WHERE device_id = $1', [deviceId]);
            if (parseInt(limitCheck.rows[0].count, 10) >= 2) {
                return res.status(403).json({ error: 'Bu cihazdan en fazla 2 hesap oluşturulabilir veya kullanılabilir.' });
            }
        }

        let hashedPassword = null;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        const result = await db.query(
            `INSERT INTO users 
             (username, email, phone, password_hash, display_name, avatar_url, bio, gender, country, level, vip_level, coin_balance, diamond_balance, status, device_id, balance) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, 0, 100, 0, 'active', $10, 100) 
             RETURNING *`,
            [username.trim(), normalizedEmail, phone || null, hashedPassword, finalDisplayName, finalAvatarUrl, bio || null, gender || null, country || null, deviceId || null]
        );

        const user = result.rows[0];

        await assignFakeInteractions(user.id);
        await triggerAutoEngagement(io, user.id);

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, display_name: user.display_name, avatar_url: user.avatar_url, gender: user.gender },
            SECRET_KEY,
            { expiresIn: '30d' }
        );

        await logActivity(io, user.id, 'register', 'Yeni kullanıcı kayıt oldu.');
        if (io) io.emit('new_user', sanitizeUser(user, req));
        
        res.status(201).json({ user: sanitizeUser(user, req), token });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Kullanıcı adı veya iletişim bilgisi zaten kullanımda.' });
        }
        res.status(500).json({ error: err.message });
    }
};

// Login User (Phase 1)
exports.loginEmail = async (req, res) => {
    let { email, phone, password, deviceId } = req.body;
    const io = req.app.get('io');

    try {
        let result;
        if (email) {
            const normalizedEmail = email.trim().toLowerCase();
            result = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
        } else if (phone) {
            result = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
        } else {
            return res.status(400).json({ error: 'E-posta veya telefon girilmelidir.' });
        }

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Giriş bilgileri hatalı.' });
        }

        const user = result.rows[0];

        // Check password if exists
        if (password && (user.password_hash || user.password)) {
            const valid = await bcrypt.compare(password, user.password_hash || user.password);
            if (!valid) {
                return res.status(401).json({ error: 'Giriş bilgileri hatalı.' });
            }
        }

        // Validate user status
        const currentStatus = user.status || user.account_status || 'active';
        if (currentStatus === 'banned') {
            return res.status(403).json({ error: 'Hesabınız askıya alınmış.' });
        } else if (currentStatus === 'deleted') {
            return res.status(403).json({ error: 'Bu hesap silinmiş.' });
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
            { id: user.id, username: user.username, role: user.role, display_name: user.display_name, avatar_url: user.avatar_url, gender: user.gender },
            SECRET_KEY,
            { expiresIn: '30d' }
        );

        await logActivity(io, user.id, 'login', 'Kullanıcı giriş yaptı.');
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
            gender: user.gender,
            display_name: user.display_name,
            referral_code: user.referral_code,
            onboarding_completed: user.onboarding_completed,
            is_agency_owner: !!user.is_agency_owner
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
