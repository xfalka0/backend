const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/store/items
// Lists active catalog items, optionally filtered by category
router.get('/items', async (req, res) => {
    try {
        const { category, rarity } = req.query;
        let query = 'SELECT * FROM store_items WHERE is_active = TRUE';
        const params = [];

        if (category) {
            params.push(category);
            query += ` AND category = $${params.length}`;
        }
        if (rarity) {
            params.push(rarity);
            query += ` AND rarity = $${params.length}`;
        }

        query += ' ORDER BY sort_order ASC, id ASC';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('[STORE] Get items error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/store/items/:id
// Gets a single catalog item's details
router.get('/items/:id', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM store_items WHERE id = $1 AND is_active = TRUE',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ürün bulunamadı.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[STORE] Get item detail error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/store/purchase
// Secure transaction to buy a store item using user coins
router.post('/purchase', authenticateToken, async (req, res) => {
    const userId = req.user.id.toString();
    const { itemId } = req.body;

    if (!itemId) {
        return res.status(400).json({ error: 'itemId parametresi eksik.' });
    }

    try {
        await db.query('BEGIN');

        // 1. Fetch store item details
        const itemRes = await db.query(
            'SELECT * FROM store_items WHERE id = $1 AND is_active = TRUE',
            [itemId]
        );
        if (itemRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Geçersiz veya aktif olmayan ürün.' });
        }
        const item = itemRes.rows[0];

        // 2. Fetch user's live balance and vip_level
        const userRes = await db.query(
            'SELECT balance, vip_level FROM users WHERE id = $1 FOR UPDATE',
            [userId]
        );
        if (userRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }
        const user = userRes.rows[0];

        // Verify VIP Level lock
        const requiredVip = parseInt(item.min_vip_level || 0, 10);
        const userVip = parseInt(user.vip_level || 0, 10);
        if (requiredVip > 0 && userVip < requiredVip) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: `Bu premium ürünü satın alabilmek için en az VIP Seviye ${requiredVip} olmalısınız.` });
        }

        // 3. Verify sufficient coins
        if (user.balance < item.price) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Bu ürünü satın almak için yeterli altınınız yok.' });
        }

        const balanceBefore = user.balance;
        const balanceAfter = user.balance - item.price;
        const transactionId = `txn_store_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        // 4. Deduct coins from user balance
        await db.query(
            'UPDATE users SET balance = balance - $1 WHERE id = $2',
            [item.price, userId]
        );

        // 5. Add to user inventory
        let expiresAt = null;
        if (item.duration_days) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + item.duration_days);
        }

        const inventoryInsert = await db.query(`
            INSERT INTO user_inventory (user_id, item_id, category, expires_at, source, is_equipped)
            VALUES ($1, $2, $3, $4, 'purchase', FALSE)
            RETURNING *
        `, [userId, item.id, item.category, expiresAt]);

        // 6. Add purchase log
        await db.query(`
            INSERT INTO store_purchase_logs (user_id, item_id, price, currency, duration_days, balance_before, balance_after, transaction_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [userId, item.id, item.price, item.currency, item.duration_days, balanceBefore, balanceAfter, transactionId]);

        // 7. Record transaction
        await db.query(`
            INSERT INTO transactions (user_id, amount, type, description)
            VALUES ($1, $2, 'spend_gift', $3)
        `, [userId, -item.price, `${item.name} Mağaza Ürünü Satın Alımı`]);

        await db.query('COMMIT');

        // 8. Emit balance update socket event
        const io = req.app.get('io');
        if (io) io.emit('balance_update', { userId, newBalance: balanceAfter });

        res.json({
            success: true,
            newBalance: balanceAfter,
            inventoryItem: inventoryInsert.rows[0],
            message: `${item.name} başarıyla satın alındı! Çantandan aktifleştirebilirsin.`
        });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('[STORE] Purchase error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/store/purchase-history
// Lists the user's store purchase logs
router.get('/purchase-history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id.toString();
        const result = await db.query(`
            SELECT spl.*, si.name, si.key, si.category, si.rarity, si.thumbnail_url 
            FROM store_purchase_logs spl
            JOIN store_items si ON spl.item_id = si.id
            WHERE spl.user_id = $1
            ORDER BY spl.purchased_at DESC
        `, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('[STORE] Get history error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/store/my-inventory
// Helper route for checking active items (used by the future BagScreen)
router.get('/my-inventory', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id.toString();
        const result = await db.query(`
            SELECT ui.*, si.name, si.key, si.description, si.thumbnail_url, si.rarity, si.animation_type 
            FROM user_inventory ui
            JOIN store_items si ON ui.item_id = si.id
            WHERE ui.user_id = $1 AND (ui.expires_at IS NULL OR ui.expires_at > NOW())
            ORDER BY ui.purchased_at DESC
        `, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('[STORE] Get inventory error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
