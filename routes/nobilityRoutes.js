const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/nobility/titles
// List all active nobility titles
router.get('/titles', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM nobility_titles WHERE is_active = TRUE ORDER BY level ASC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[NOBILITY] Get titles error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/nobility/me
// Get user's active nobility title
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id.toString();
        const result = await db.query(`
            SELECT un.*, nt.key, nt.name, nt.level, nt.badge_url, nt.name_color, nt.priority_weight 
            FROM user_nobility un
            JOIN nobility_titles nt ON un.title_id = nt.id
            WHERE un.user_id = $1 AND un.is_active = TRUE AND un.expires_at > NOW()
            ORDER BY nt.priority_weight DESC
            LIMIT 1
        `, [userId]);

        if (result.rows.length === 0) {
            return res.json(null);
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('[NOBILITY] Get active error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/nobility/purchase
// Buy/activate a new nobility title
router.post('/purchase', authenticateToken, async (req, res) => {
    const userId = req.user.id.toString();
    const { titleId } = req.body;

    if (!titleId) {
        return res.status(400).json({ error: 'titleId parametresi eksik.' });
    }

    try {
        await db.query('BEGIN');

        // Fetch nobility title
        const titleRes = await db.query(
            'SELECT * FROM nobility_titles WHERE id = $1 AND is_active = TRUE',
            [titleId]
        );
        if (titleRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Geçersiz unvan.' });
        }
        const title = titleRes.rows[0];

        // Fetch user bakiye
        const userRes = await db.query(
            'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
            [userId]
        );
        if (userRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }
        const user = userRes.rows[0];

        if (user.balance < title.price) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Bu unvanı almak için yeterli altının yok.' });
        }

        // Check if user already has this title active
        const existing = await db.query(`
            SELECT id FROM user_nobility 
            WHERE user_id = $1 AND title_id = $2 AND is_active = TRUE AND expires_at > NOW()
        `, [userId, title.id]);

        if (existing.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Bu unvan zaten aktif. İstersen süresini uzatabilirsin.' });
        }

        // Check if user has any active title and upgrade/deactivate it
        const currentActive = await db.query(`
            SELECT un.*, nt.level 
            FROM user_nobility un
            JOIN nobility_titles nt ON un.title_id = nt.id
            WHERE un.user_id = $1 AND un.is_active = TRUE AND un.expires_at > NOW()
        `, [userId]);

        let purchaseType = 'new_purchase';
        let oldTitleId = null;

        if (currentActive.rows.length > 0) {
            const currentTitle = currentActive.rows[0];
            oldTitleId = currentTitle.title_id;
            
            if (title.level > currentTitle.level) {
                purchaseType = 'upgrade';
            } else {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'Zaten daha yüksek veya eşdeğer seviyede aktif bir unvanınız bulunuyor.' });
            }

            // Deactivate old title
            await db.query(`
                UPDATE user_nobility SET is_active = FALSE 
                WHERE id = $1
            `, [currentTitle.id]);
        }

        // Deduct price from user balance
        const updateRes = await db.query(`
            UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING balance
        `, [title.price, userId]);

        const newBalance = updateRes.rows[0].balance;

        // Insert user nobility record (30 days from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + title.duration_days);

        const nobilityInsert = await db.query(`
            INSERT INTO user_nobility (user_id, title_id, expires_at, is_active, purchased_price)
            VALUES ($1, $2, $3, TRUE, $4)
            RETURNING *
        `, [userId, title.id, expiresAt, title.price]);

        // Insert log
        await db.query(`
            INSERT INTO nobility_purchase_logs (user_id, title_id, price, purchase_type, old_title_id)
            VALUES ($1, $2, $3, $4, $5)
        `, [userId, title.id, title.price, purchaseType, oldTitleId]);

        // Record transaction
        await db.query(`
            INSERT INTO transactions (user_id, amount, type, description)
            VALUES ($1, $2, 'spend_gift', $3)
        `, [userId, -title.price, `${title.name} Asalet Unvanı Satın Alımı`]);

        await db.query('COMMIT');

        // Emit balance update
        const io = req.app.get('io');
        if (io) io.emit('balance_update', { userId, newBalance });

        res.json({
            success: true,
            new_balance: newBalance,
            nobility: {
                ...nobilityInsert.rows[0],
                key: title.key,
                name: title.name,
                level: title.level,
                badge_url: title.badge_url,
                name_color: title.name_color,
                priority_weight: title.priority_weight
            },
            message: purchaseType === 'upgrade' ? 'Asalet unvanın yükseltildi.' : 'Asalet unvanın aktif edildi.'
        });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('[NOBILITY] Purchase error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/nobility/renew
// Renew current active title
router.post('/renew', authenticateToken, async (req, res) => {
    const userId = req.user.id.toString();
    const { titleId } = req.body;

    if (!titleId) {
        return res.status(400).json({ error: 'titleId parametresi eksik.' });
    }

    try {
        await db.query('BEGIN');

        // Fetch nobility title
        const titleRes = await db.query(
            'SELECT * FROM nobility_titles WHERE id = $1 AND is_active = TRUE',
            [titleId]
        );
        if (titleRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Geçersiz unvan.' });
        }
        const title = titleRes.rows[0];

        // Fetch user bakiye
        const userRes = await db.query(
            'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
            [userId]
        );
        if (userRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }
        const user = userRes.rows[0];

        if (user.balance < title.price) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Bu unvanı almak için yeterli altının yok.' });
        }

        // Check if user has this title currently (active or expired)
        const current = await db.query(`
            SELECT * FROM user_nobility 
            WHERE user_id = $1 AND title_id = $2 
            ORDER BY expires_at DESC LIMIT 1
        `, [userId, title.id]);

        let newExpiresAt = new Date();
        let recordId = null;

        if (current.rows.length > 0 && current.rows[0].is_active) {
            const currentRecord = current.rows[0];
            const currentExpires = new Date(currentRecord.expires_at);
            
            if (currentExpires > new Date()) {
                // Not expired yet: extend current expiry date by 30 days
                newExpiresAt = new Date(currentExpires.getTime());
                newExpiresAt.setDate(newExpiresAt.getDate() + title.duration_days);
            } else {
                // Expired: start 30 days from now
                newExpiresAt.setDate(newExpiresAt.getDate() + title.duration_days);
            }
            recordId = currentRecord.id;
        } else {
            // No record: start 30 days from now
            newExpiresAt.setDate(newExpiresAt.getDate() + title.duration_days);
        }

        // Deduct price from user balance
        const updateRes = await db.query(`
            UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING balance
        `, [title.price, userId]);

        const newBalance = updateRes.rows[0].balance;

        let nobilityResult;
        if (recordId) {
            // Update existing
            nobilityResult = await db.query(`
                UPDATE user_nobility 
                SET expires_at = $1, is_active = TRUE, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2 RETURNING *
            `, [newExpiresAt, recordId]);
        } else {
            // Insert new active title
            nobilityResult = await db.query(`
                INSERT INTO user_nobility (user_id, title_id, expires_at, is_active, purchased_price)
                VALUES ($1, $2, $3, TRUE, $4) RETURNING *
            `, [userId, title.id, newExpiresAt, title.price]);
        }

        // Insert log
        await db.query(`
            INSERT INTO nobility_purchase_logs (user_id, title_id, price, purchase_type, old_title_id)
            VALUES ($1, $2, $3, 'renew', $4)
        `, [userId, title.id, title.price, title.id]);

        // Record transaction
        await db.query(`
            INSERT INTO transactions (user_id, amount, type, description)
            VALUES ($1, $2, 'spend_gift', $3)
        `, [userId, -title.price, `${title.name} Asalet Unvanı Süre Uzatma`]);

        await db.query('COMMIT');

        // Emit balance update
        const io = req.app.get('io');
        if (io) io.emit('balance_update', { userId, newBalance });

        res.json({
            success: true,
            new_balance: newBalance,
            nobility: {
                ...nobilityResult.rows[0],
                key: title.key,
                name: title.name,
                level: title.level,
                badge_url: title.badge_url,
                name_color: title.name_color,
                priority_weight: title.priority_weight
            },
            message: 'Asalet unvanın yenilendi.'
        });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('[NOBILITY] Renew error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/nobility/upgrade
// Upgrade to a higher level title (convenience mapping of purchase)
router.post('/upgrade', authenticateToken, async (req, res) => {
    // Simply redirect to purchase as purchase endpoint handles upgrades automatically
    res.redirect(307, '/api/nobility/purchase');
});

module.exports = router;
