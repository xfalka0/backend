const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const {
    getSchemaAvailability,
    getRetentionOverview,
    getAcquisitionOverview,
    getSubscriptionsOverview,
    getTargetsAndComparison,
    getReadOnlyUserDetail,
} = require('../services/adminInsightsService');
const {
    getSchedulerHealthStatus,
    buildDailySummaryData,
    renderDailySummaryEmail,
    runDailySummaryJob,
} = require('../services/dailySummaryEmailService');

const adminOnly = [authenticateToken, authorizeRole('admin', 'super_admin')];

// 1) Retention + 8-week Cohort (fixes legacy /api/admin/analytics/retention)
router.get('/analytics/retention', ...adminOnly, async (req, res) => {
    try {
        const data = await getRetentionOverview(db, req.query.days || 30);
        res.json(data);
    } catch (err) {
        console.error('[RETENTION OVERVIEW ERROR]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 2) Kayıt Kaynağı & Reklam Maliyeti
router.get('/analytics/acquisition', ...adminOnly, async (req, res) => {
    try {
        const data = await getAcquisitionOverview(db, req.query.days || 30);
        res.json(data);
    } catch (err) {
        console.error('[ACQUISITION ERROR]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/analytics/ad-spends', ...adminOnly, async (req, res) => {
    try {
        const schema = await getSchemaAvailability(db);
        if (!schema.hasAdSpends) {
            return res.status(400).json({ error: 'ad_spends tablosu henüz oluşturulmamış. Önce migration çalıştırılmalıdır.' });
        }
        const { spend_date, source, campaign, amount, notes } = req.body;
        const parsedAmount = parseFloat(amount);
        if (!spend_date || !/^\d{4}-\d{2}-\d{2}$/.test(spend_date)) {
            return res.status(400).json({ error: 'Geçerli tarih (YYYY-AA-GG) giriniz.' });
        }
        if (!source || !String(source).trim()) {
            return res.status(400).json({ error: 'Kaynak adı zorunludur.' });
        }
        if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
            return res.status(400).json({ error: 'Geçerli bir tutar (₺) giriniz.' });
        }
        const r = await db.query(
            `INSERT INTO ad_spends (spend_date, source, campaign, amount, notes)
             VALUES ($1::date, $2, $3, $4, $5)
             RETURNING id, TO_CHAR(spend_date, 'YYYY-MM-DD') AS spend_date, source, campaign, amount::numeric(12,2), notes, created_at`,
            [spend_date, String(source).trim().toLowerCase(), String(campaign || '').trim(), parsedAmount, String(notes || '').trim() || null]
        );
        res.status(201).json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/analytics/ad-spends/:id', ...adminOnly, async (req, res) => {
    try {
        const schema = await getSchemaAvailability(db);
        if (!schema.hasAdSpends) {
            return res.status(400).json({ error: 'ad_spends tablosu henüz mevcut değil.' });
        }
        await db.query('DELETE FROM ad_spends WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3) Premium / Abonelik Yönetimi
router.get('/subscriptions/overview', ...adminOnly, async (req, res) => {
    try {
        const excludeTest = req.query.excludeTest !== '0' && req.query.excludeTest !== 'false';
        const data = await getSubscriptionsOverview(db, { excludeTest });
        res.json(data);
    } catch (err) {
        console.error('[SUBSCRIPTIONS OVERVIEW ERROR]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 4) E-posta Özeti, Eşikler ve Zamanlayıcı Durumu
router.get('/alerts/status', ...adminOnly, async (req, res) => {
    try {
        const [health, summaryData] = await Promise.all([
            getSchedulerHealthStatus(db),
            buildDailySummaryData(db)
        ]);
        const preview = renderDailySummaryEmail(summaryData);
        res.json({ health, summaryData, preview });
    } catch (err) {
        console.error('[ALERTS STATUS ERROR]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.put('/alerts/settings', ...adminOnly, async (req, res) => {
    try {
        const schema = await getSchemaAvailability(db);
        if (!schema.hasAlertSettings) {
            return res.status(400).json({ error: 'admin_alert_settings tablosu henüz oluşturulmamış. Önce migration çalıştırılmalıdır.' });
        }
        const dropPct = Math.min(99, Math.max(1, parseFloat(req.body.alert_revenue_drop_pct ?? 50)));
        const spikeMult = Math.min(50, Math.max(1.1, parseFloat(req.body.alert_signup_spike_mult ?? 3)));
        const supportLimit = Math.min(1000, Math.max(1, parseInt(req.body.alert_pending_support_limit ?? 20, 10)));

        const r = await db.query(`
            INSERT INTO admin_alert_settings (id, alert_revenue_drop_pct, alert_signup_spike_mult, alert_pending_support_limit, updated_at)
            VALUES (1, $1, $2, $3, NOW())
            ON CONFLICT (id) DO UPDATE SET
                alert_revenue_drop_pct = EXCLUDED.alert_revenue_drop_pct,
                alert_signup_spike_mult = EXCLUDED.alert_signup_spike_mult,
                alert_pending_support_limit = EXCLUDED.alert_pending_support_limit,
                updated_at = NOW()
            RETURNING *
        `, [dropPct, spikeMult, supportLimit]);
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/alerts/test-summary', ...adminOnly, async (req, res) => {
    try {
        const result = await runDailySummaryJob(db, {
            triggerSource: 'manual_test',
            isEndOfDay: true,
            writePreviewFiles: Boolean(req.body?.writePreviewFiles)
        });
        res.json(result);
    } catch (err) {
        console.error('[TEST SUMMARY ERROR]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 5) Karşılaştırma ve Aylık Hedefler
router.get('/targets', ...adminOnly, async (req, res) => {
    try {
        const data = await getTargetsAndComparison(db, req.query.month || null);
        res.json(data);
    } catch (err) {
        console.error('[TARGETS GET ERROR]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.put('/targets', ...adminOnly, async (req, res) => {
    try {
        const schema = await getSchemaAvailability(db);
        if (!schema.hasMonthlyTargets) {
            return res.status(400).json({ error: 'monthly_targets tablosu henüz oluşturulmamış. Önce migration çalıştırılmalıdır.' });
        }
        const { monthKey, revenueTarget, registrationsTarget } = req.body;
        if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
            return res.status(400).json({ error: 'Geçerli ay anahtarı (YYYY-AA) giriniz.' });
        }
        const rev = Math.max(0, parseFloat(revenueTarget || 0));
        const reg = Math.max(0, parseInt(registrationsTarget || 0, 10));
        await db.query(`
            INSERT INTO monthly_targets (month_key, revenue_target, registrations_target, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (month_key) DO UPDATE SET
                revenue_target = EXCLUDED.revenue_target,
                registrations_target = EXCLUDED.registrations_target,
                updated_at = NOW()
        `, [monthKey, rev, reg]);
        const updated = await getTargetsAndComparison(db, monthKey);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6) Salt-Okunur Kullanıcı Detay Sayfası (yazma işlemi YOK)
router.get('/users/:userId/detail', ...adminOnly, async (req, res) => {
    try {
        const detail = await getReadOnlyUserDetail(db, req.params.userId);
        if (!detail) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        res.json(detail);
    } catch (err) {
        console.error('[USER DETAIL ERROR]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Dış Cron Job (Render Cron / cron-job.org) için güvenli gün sonu tetikleme endpoint'i
const cronRouter = express.Router();
cronRouter.post('/daily-summary', async (req, res) => {
    const secret = (process.env.CRON_SECRET || '').trim();
    if (!secret) {
        return res.status(401).json({ error: 'CRON_SECRET ortam değişkeni tanımlı değil.' });
    }
    const provided = (req.headers['x-cron-secret'] || req.query.secret || '').toString();
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(secret, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({ error: 'Yetkisiz cron isteği.' });
    }
    try {
        const result = await runDailySummaryJob(db, {
            triggerSource: 'external_cron',
            isEndOfDay: true,
        });
        res.json({ success: true, skipped: result.skipped, delivery: result.delivery, alerts: result.alerts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = { adminInsightsRouter: router, cronInsightsRouter: cronRouter };
