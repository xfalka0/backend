const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const {
    TR_TZ,
    ensureLockedPhotoPromoSchema,
    getIstanbulClock,
    isInEveningActiveWindow,
    isInOfflinePushWindow,
    getLockedPromoSettings,
    deliverLockedPhotoToUser,
    runLockedPhotoPromoSweep,
} = require('../services/lockedPhotoPromoService');

const adminOnly = [authenticateToken, authorizeRole('admin', 'super_admin')];

// GET /api/admin/locked-photos — Havuz listesi, özet metrikler, ayarlar ve son gönderimler
router.get('/', ...adminOnly, async (req, res) => {
    try {
        await ensureLockedPhotoPromoSchema();
        const [photosRes, summaryRes, settings, deliveriesRes] = await Promise.all([
            db.query(`
                SELECT id, title, image_url, unlock_cost, pre_message, is_active,
                       sent_count, insufficient_hits, unlock_count,
                       purchase_conversion_count, conversion_revenue,
                       created_at, updated_at
                FROM locked_photo_pool
                ORDER BY created_at DESC, id DESC
            `),
            db.query(`
                SELECT
                    COUNT(*)::int AS total_photos,
                    COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active_photos,
                    COALESCE(SUM(sent_count), 0)::int AS total_sent,
                    COALESCE(SUM(insufficient_hits), 0)::int AS total_insufficient_hits,
                    COALESCE(SUM(unlock_count), 0)::int AS total_unlocks,
                    COALESCE(SUM(purchase_conversion_count), 0)::int AS total_conversions,
                    COALESCE(SUM(conversion_revenue), 0)::numeric(12, 2) AS total_revenue,
                    (
                        SELECT COUNT(*)::int
                        FROM locked_photo_deliveries d
                        WHERE d.trigger_type != 'manual_test'
                          AND (d.created_at AT TIME ZONE '${TR_TZ}')::date = (NOW() AT TIME ZONE '${TR_TZ}')::date
                    ) AS today_sent
                FROM locked_photo_pool
            `),
            getLockedPromoSettings(),
            db.query(`
                SELECT d.id, d.photo_id, d.user_id, d.operator_id, d.trigger_type,
                       d.pre_message_text, d.unlock_cost, d.is_unlocked, d.unlocked_at,
                       d.insufficient_funds_hit_at, d.converted_to_purchase, d.converted_amount,
                       d.converted_at, d.created_at,
                       p.title AS photo_title, p.image_url AS photo_url,
                       COALESCE(u.display_name, u.username) AS user_name, u.username AS user_username,
                       COALESCE(op.display_name, op.username) AS operator_name
                FROM locked_photo_deliveries d
                LEFT JOIN locked_photo_pool p ON d.photo_id = p.id
                LEFT JOIN users u ON d.user_id = u.id
                LEFT JOIN users op ON d.operator_id = op.id
                ORDER BY d.created_at DESC
                LIMIT 30
            `),
        ]);

        const clock = getIstanbulClock();
        res.json({
            photos: photosRes.rows,
            summary: summaryRes.rows[0] || {},
            settings,
            recentDeliveries: deliveriesRes.rows,
            status: {
                istanbulHour: clock.hour,
                istanbulMinute: clock.minute,
                inEveningActiveWindow: isInEveningActiveWindow(settings, clock),
                inOfflinePushWindow: isInOfflinePushWindow(settings, clock),
            },
        });
    } catch (err) {
        console.error('[ADMIN_LOCKED_PHOTOS] GET error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/locked-photos — Tekli veya çoklu kilitli fotoğraf ekle
router.post('/', ...adminOnly, async (req, res) => {
    try {
        await ensureLockedPhotoPromoSchema();
        const { items, title, image_url, unlock_cost, pre_message, is_active } = req.body || {};

        const entries = Array.isArray(items) && items.length > 0
            ? items
            : (image_url ? [{ title, image_url, unlock_cost, pre_message, is_active }] : []);

        if (entries.length === 0) {
            return res.status(400).json({ error: 'En az bir fotoğraf URL’si gereklidir.' });
        }

        const inserted = [];
        for (const entry of entries) {
            const url = String(entry?.image_url || '').trim();
            if (!url) continue;
            const cleanTitle = entry?.title ? String(entry.title).trim().slice(0, 150) : null;
            const parsedCost = Math.max(1, parseInt(entry?.unlock_cost, 10) || 100);
            const cleanPre = entry?.pre_message ? String(entry.pre_message).trim() : null;
            const active = entry?.is_active !== false;

            const r = await db.query(
                `INSERT INTO locked_photo_pool (title, image_url, unlock_cost, pre_message, is_active)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [cleanTitle, url, parsedCost, cleanPre, active]
            );
            inserted.push(r.rows[0]);
        }

        if (inserted.length === 0) {
            return res.status(400).json({ error: 'Geçerli fotoğraf bulunamadı.' });
        }

        res.status(201).json(inserted.length === 1 ? inserted[0] : { inserted });
    } catch (err) {
        console.error('[ADMIN_LOCKED_PHOTOS] POST error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/admin/locked-photos/:id — Fotoğraf fiyat, ön mesaj veya aktiflik düzenle
router.patch('/:id', ...adminOnly, async (req, res) => {
    try {
        await ensureLockedPhotoPromoSchema();
        const id = parseInt(req.params.id, 10);
        if (!id) return res.status(400).json({ error: 'Geçersiz fotoğraf ID.' });

        const { title, unlock_cost, pre_message, is_active } = req.body || {};

        const existingRes = await db.query('SELECT * FROM locked_photo_pool WHERE id = $1', [id]);
        if (existingRes.rows.length === 0) {
            return res.status(404).json({ error: 'Fotoğraf bulunamadı.' });
        }
        const cur = existingRes.rows[0];

        const nextTitle = title !== undefined ? (title ? String(title).trim().slice(0, 150) : null) : cur.title;
        const nextCost = unlock_cost !== undefined ? Math.max(1, parseInt(unlock_cost, 10) || 100) : cur.unlock_cost;
        const nextPre = pre_message !== undefined ? (pre_message ? String(pre_message).trim() : null) : cur.pre_message;
        const nextActive = typeof is_active === 'boolean' ? is_active : cur.is_active;

        const upd = await db.query(
            `UPDATE locked_photo_pool
             SET title = $1, unlock_cost = $2, pre_message = $3, is_active = $4, updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [nextTitle, nextCost, nextPre, nextActive, id]
        );
        res.json(upd.rows[0]);
    } catch (err) {
        console.error('[ADMIN_LOCKED_PHOTOS] PATCH error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/admin/locked-photos/:id — Havuzdan sil
router.delete('/:id', ...adminOnly, async (req, res) => {
    try {
        await ensureLockedPhotoPromoSchema();
        const id = parseInt(req.params.id, 10);
        if (!id) return res.status(400).json({ error: 'Geçersiz fotoğraf ID.' });
        await db.query('DELETE FROM locked_photo_pool WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('[ADMIN_LOCKED_PHOTOS] DELETE error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/admin/locked-photos/settings — Otomasyon ayarlarını güncelle
router.put('/settings', ...adminOnly, async (req, res) => {
    try {
        await ensureLockedPhotoPromoSchema();
        const cur = await getLockedPromoSettings();
        const b = req.body || {};

        const clampInt = (val, min, max, fallback) => {
            const n = parseInt(val, 10);
            if (isNaN(n)) return fallback;
            return Math.min(max, Math.max(min, n));
        };

        const isEnabled = typeof b.is_enabled === 'boolean' ? b.is_enabled : cur.is_enabled;
        const defaultCost = clampInt(b.default_unlock_cost, 1, 10000, cur.default_unlock_cost);
        const dailyCap = clampInt(b.daily_cap, 1, 5, cur.daily_cap);
        const activeStartHour = clampInt(b.active_start_hour, 0, 23, cur.active_start_hour);
        const activeEndHour = clampInt(b.active_end_hour, 0, 23, cur.active_end_hour);
        const offlineStartMin = clampInt(b.offline_start_minute, 0, 1439, cur.offline_start_minute);
        const offlineEndMin = clampInt(b.offline_end_minute, 0, 1439, cur.offline_end_minute);
        const minInactiveHours = clampInt(b.min_inactive_hours, 1, 72, cur.min_inactive_hours);
        const maxInactiveDays = clampInt(b.max_inactive_days, 1, 90, cur.max_inactive_days);
        const numaraCooldownHours = clampInt(b.numara_cooldown_hours, 1, 72, cur.numara_cooldown_hours);

        const upd = await db.query(
            `UPDATE admin_locked_promo_settings
             SET is_enabled = $1,
                 default_unlock_cost = $2,
                 daily_cap = $3,
                 active_start_hour = $4,
                 active_end_hour = $5,
                 offline_start_minute = $6,
                 offline_end_minute = $7,
                 min_inactive_hours = $8,
                 max_inactive_days = $9,
                 numara_cooldown_hours = $10,
                 updated_at = NOW()
             WHERE id = 1
             RETURNING *`,
            [
                isEnabled,
                defaultCost,
                dailyCap,
                activeStartHour,
                activeEndHour,
                offlineStartMin,
                offlineEndMin,
                minInactiveHours,
                maxInactiveDays,
                numaraCooldownHours,
            ]
        );
        res.json(upd.rows[0]);
    } catch (err) {
        console.error('[ADMIN_LOCKED_PHOTOS] PUT /settings error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/locked-photos/run-sweep — Zamanlayıcıyı hemen çalıştır
router.post('/run-sweep', ...adminOnly, async (req, res) => {
    try {
        const io = req.app.get('io');
        const result = await runLockedPhotoPromoSweep(io);
        res.json({ success: true, result });
    } catch (err) {
        console.error('[ADMIN_LOCKED_PHOTOS] run-sweep error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/locked-photos/test-send — Belirli bir kullanıcıya test gönderimi yap
router.post('/test-send', ...adminOnly, async (req, res) => {
    try {
        await ensureLockedPhotoPromoSchema();
        const { target, photoId } = req.body || {};
        const cleanTarget = String(target || '').trim();
        if (!cleanTarget) {
            return res.status(400).json({ error: 'Kullanıcı ID veya kullanıcı adı girin.' });
        }

        const userRes = await db.query(
            'SELECT id, username, display_name FROM users WHERE id::text = $1 OR LOWER(username) = LOWER($1) LIMIT 1',
            [cleanTarget]
        );
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const targetUser = userRes.rows[0];
        const io = req.app.get('io');
        const result = await deliverLockedPhotoToUser({
            io,
            userId: targetUser.id,
            triggerType: 'manual_test',
            forcePhotoId: photoId ? parseInt(photoId, 10) : null,
            bypassChecks: true,
        });

        if (!result.sent) {
            return res.status(400).json({ error: `Gönderilemedi: ${result.reason}`, result });
        }

        res.json({ success: true, targetUser, result });
    } catch (err) {
        console.error('[ADMIN_LOCKED_PHOTOS] test-send error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

