const jwt = require('jsonwebtoken');
const db = require('../db');

const SECRET_KEY = process.env.JWT_SECRET || 'your_super_secret_key_change_in_prod';

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Erişim reddedildi. Token bulunamadı.' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);

        // Verify user still exists and is active
        const result = await db.query('SELECT id, username, email, role, account_status, display_name, avatar_url, gender FROM users WHERE id = $1', [decoded.id]);

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const user = result.rows[0];

        if (user.account_status !== 'active') {
            return res.status(403).json({ error: 'Hesap aktif değil.' });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error("Auth Error:", err.message);
        return res.status(403).json({ error: 'Geçersiz token.' });
    }
};

const authorizeRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
        }
        next();
    };
};

module.exports = { authenticateToken, authorizeRole, SECRET_KEY };
