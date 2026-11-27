const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { withTransaction } = require('../utils/dbUtils');
const { creditCoinPurchaseAtomic } = require('../utils/revenuecatUtils');

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
    if (!userId || !productId || !transactionId) {
        return res.status(400).json({ error: 'Eksik parametreler. transactionId ve productId zorunludur.' });
    }

    try {
        const pkgRes = await db.query(
            'SELECT * FROM coin_packages WHERE id = $1 OR revenuecat_id = $2',
            [isNaN(productId) ? -1 : parseInt(productId, 10), productId]
        );
        if (pkgRes.rows.length === 0) {
            return res.status(404).json({ error: 'Paket bulunamadı.' });
        }

        const price = parseFloat(pkgRes.rows[0].price);
        const coinsToAdd = parseInt(pkgRes.rows[0].coins, 10);
        const packageName = pkgRes.rows[0].name;
        const packageId = pkgRes.rows[0].id;

        const txResult = await withTransaction(db, (client) =>
            creditCoinPurchaseAtomic(client, {
                userId,
                coinsToAdd,
                price,
                packageId,
                packageName,
                primaryTxId: transactionId,
                paymentMethod: 'in_app',
                txDescription: `${packageName} satın alındı`,
                allowPairSourceMethods: ['revenuecat', 'revenuecat_autoclaim'],
                pairFromClientToCanonical: false,
            })
        );

        if (txResult.userNotFound) {
            return res.status(404).json({ error: 'Kullanıcı güncellenemedi.' });
        }
        if (txResult.alreadyProcessed) {
            return res.status(400).json({ error: 'Bu işlem zaten gerçekleştirilmiş.' });
        }

        const newBalance = txResult.balance;
        const newVipLevel = txResult.vipLevel;
        const oldVipLevel = txResult.oldVipLevel;
        const newVipXp = txResult.vipXp;

        const io = req.app.get('io');
        if (io) {
            io.to(`user_${userId}`).emit('balance_update', {
                balance: newBalance,
                hearts: newBalance,
                vip_level: newVipLevel,
                vip_xp: newVipXp
            });
            if (newVipLevel > oldVipLevel) {
                io.to(`user_${userId}`).emit('vip_level_up', {
                    vip_level: newVipLevel,
                    old_vip_level: oldVipLevel,
                    vip_xp: newVipXp
                });
            }
        }

        // REFERRAL RECHARGE REWARD LOGIC (First Purchase Only)
        try {
            const userRes = await db.query('SELECT referred_by, device_id FROM users WHERE id = $1', [userId]);
            if (userRes.rows.length > 0 && userRes.rows[0].referred_by) {
                const referredBy = userRes.rows[0].referred_by;
                const userDeviceId = userRes.rows[0].device_id;
                
                const rewardCheck = await db.query(
                    "SELECT id FROM referral_rewards WHERE referrer_id = $1 AND referred_id = $2 AND reward_type = 'first_purchase'",
                    [referredBy, userId]
                );

                if (rewardCheck.rows.length === 0) {
                    let fraudDetected = false;
                    if (userDeviceId) {
                        const refUserRes = await db.query('SELECT device_id FROM users WHERE id = $1', [referredBy]);
                        if (refUserRes.rows.length > 0 && refUserRes.rows[0].device_id === userDeviceId) {
                            fraudDetected = true;
                            console.log(`[REFERRAL_FRAUD_PURCHASE] User ${userId} and Referrer ${referredBy} share device_id`);
                        }
                    }

                    if (!fraudDetected) {
                        await db.query('UPDATE users SET balance = balance + 500 WHERE id = $1', [referredBy]);
                        await db.query("INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)", 
                            [referredBy, 500, 'referral_bonus', 'Davet ettiğiniz kullanıcı ilk yüklemesini yaptı']);
                        
                        await db.query("INSERT INTO referral_rewards (referrer_id, referred_id, reward_type, amount) VALUES ($1, $2, 'first_purchase', 500)",
                            [referredBy, userId]);

                        if (io) {
                            db.query("INSERT INTO notifications (user_id, type, body) VALUES ($1, $2, $3) RETURNING *",
                                [referredBy, 'system', 'Harika! Davet ettiğin bir arkadaşın ilk yüklemesini yaptı ve sen 500 Coin kazandın!']
                            ).then(notif => {
                                io.emit('new_notification', notif.rows[0]);
                                io.emit('balance_update', { userId: referredBy, newBalance: null });
                            }).catch(console.error);
                        }
                    }
                }
            }
        } catch (refErr) {
            console.error('[REFERRAL_PURCHASE_REWARD_ERROR]', refErr);
        }
        if (io) {
            io.emit('admin_balance_update', { userId, newBalance });
            io.emit('new_payment', {
                user_id: userId,
                amount: price || coinsToAdd,
                package_id: packageId,
                transaction_id: transactionId,
                status: 'completed',
                created_at: new Date().toISOString()
            });
            io.emit('admin_payment_update', { type: 'coins', user_id: userId });
        }

        res.json({ success: true, balance: newBalance, hearts: newBalance, vip_level: newVipLevel, coins_added: coinsToAdd });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
