const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// GET COIN PACKAGES (Admin)
router.get('/', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM coin_packages ORDER BY price ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE PACKAGE (Admin)
router.post('/', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
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

// UPDATE PACKAGE (Admin)
router.put('/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
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

// DELETE PACKAGE (Admin)
router.delete('/:id', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    try {
        await db.query('DELETE FROM coin_packages WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PURCHASE ENDPOINT
router.post('/purchase', authenticateToken, async (req, res) => {
    const { productId, transactionId } = req.body;
    const userId = req.user.id;
    if (!userId || !productId) return res.status(400).json({ error: 'Eksik parametreler.' });

    try {
        await db.query('BEGIN');
        const pkgRes = await db.query(
            'SELECT * FROM coin_packages WHERE id = $1 OR revenuecat_id = $2',
            [isNaN(productId) ? -1 : parseInt(productId), productId]
        );
        if (pkgRes.rows.length === 0) { await db.query('ROLLBACK'); return res.status(404).json({ error: 'Paket bulunamadı.' }); }

        const price = parseFloat(pkgRes.rows[0].price);
        const coinsToAdd = parseInt(pkgRes.rows[0].coins);
        const packageName = pkgRes.rows[0].name;
        const packageId = pkgRes.rows[0].id;

        const updateRes = await db.query(
            `UPDATE users SET total_spent = COALESCE(total_spent, 0) + $1, balance = COALESCE(balance, 0) + $2 WHERE id = $3 RETURNING balance, total_spent`,
            [price, coinsToAdd, userId]
        );
        if (updateRes.rows.length === 0) { await db.query('ROLLBACK'); return res.status(404).json({ error: 'Kullanıcı güncellenemedi.' }); }

        const newBalance = updateRes.rows[0].balance;
        const newTotalSpent = parseFloat(updateRes.rows[0].total_spent);
        let newVipLevel = 0;
        if (newTotalSpent >= 5000) newVipLevel = 5;
        else if (newTotalSpent >= 3500) newVipLevel = 4;
        else if (newTotalSpent >= 2000) newVipLevel = 3;
        else if (newTotalSpent >= 1000) newVipLevel = 2;
        else if (newTotalSpent >= 500) newVipLevel = 1;

        await db.query('UPDATE users SET vip_level = $1 WHERE id = $2', [newVipLevel, userId]);
        await db.query('INSERT INTO payments (user_id, package_id, transaction_id, amount, status) VALUES ($1, $2, $3, $4, $5)',
            [userId, packageId, transactionId || `manual_${Date.now()}`, price, 'completed']);
        await db.query('INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
            [userId, coinsToAdd, 'purchase', `${packageName} satın alındı`]);
        await db.query('COMMIT');

        const io = req.app.get('io');
        if (io) {
            io.emit('balance_update', { userId, newBalance });
            io.emit('admin_balance_update', { userId, newBalance });
        }

        res.json({ success: true, balance: newBalance, hearts: newBalance, vip_level: newVipLevel, coins_added: coinsToAdd });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
