const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { getSchemaAvailability } = require('./adminInsightsService');

const TR_TZ = 'Europe/Istanbul';
const NET_FACTOR = 0.65; // %35 kesinti sonrası net kazanç
const toNet = (v) => Number((parseFloat(v || 0) * NET_FACTOR).toFixed(2));
const toTrTs = (col) => `((${col}) AT TIME ZONE 'UTC' AT TIME ZONE '${TR_TZ}')`;

const DEFAULT_THRESHOLDS = {
    alert_revenue_drop_pct: 50,
    alert_signup_spike_mult: 3,
    alert_pending_support_limit: 20,
};

function getEmailTransportConfig() {
    const host = (process.env.SMTP_HOST || '').trim();
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = (process.env.SMTP_USER || '').trim();
    const pass = (process.env.SMTP_PASS || '').trim();
    const mailFrom = (process.env.MAIL_FROM || user || '').trim();
    const summaryTo = (process.env.SUMMARY_TO || 'falkasoft@gmail.com').trim();

    const configured = Boolean(host && user && pass && mailFrom);
    return {
        configured,
        host,
        port,
        secure: port === 465,
        user,
        pass,
        mailFrom,
        summaryTo,
        missingVars: [
            ...(!host ? ['SMTP_HOST'] : []),
            ...(!process.env.SMTP_PORT ? ['SMTP_PORT (varsayılan 587)'] : []),
            ...(!user ? ['SMTP_USER'] : []),
            ...(!pass ? ['SMTP_PASS'] : []),
            ...(!mailFrom ? ['MAIL_FROM'] : []),
        ]
    };
}

async function getAlertSettings(db) {
    const schema = await getSchemaAvailability(db);
    if (!schema.hasAlertSettings) {
        return { ...DEFAULT_THRESHOLDS, fromDatabase: false };
    }
    const res = await db.query('SELECT alert_revenue_drop_pct, alert_signup_spike_mult, alert_pending_support_limit, updated_at FROM admin_alert_settings WHERE id = 1');
    if (res.rows.length === 0) return { ...DEFAULT_THRESHOLDS, fromDatabase: true };
    const r = res.rows[0];
    return {
        alert_revenue_drop_pct: parseFloat(r.alert_revenue_drop_pct ?? DEFAULT_THRESHOLDS.alert_revenue_drop_pct),
        alert_signup_spike_mult: parseFloat(r.alert_signup_spike_mult ?? DEFAULT_THRESHOLDS.alert_signup_spike_mult),
        alert_pending_support_limit: parseInt(r.alert_pending_support_limit ?? DEFAULT_THRESHOLDS.alert_pending_support_limit, 10),
        updated_at: r.updated_at,
        fromDatabase: true
    };
}

async function buildDailySummaryData(db) {
    const schema = await getSchemaAvailability(db);

    const [
        revRes,
        regRes,
        miscRes,
        topPkgRes,
        pendingSupportRes,
        pendingWithdrawalsRes,
        pendingDeletionRes,
        trDateRes,
        detailStatsRes,
        topPackagesTodayRes
    ] = await Promise.all([
        db.query(`
            WITH bounds AS (
                SELECT
                    (date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS today_start,
                    ((date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '1 day') AT TIME ZONE '${TR_TZ}') AS yesterday_start,
                    ((date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '7 days') AT TIME ZONE '${TR_TZ}') AS avg7_start
            ),
            daily_7d AS (
                SELECT ${toTrTs('p.created_at')}::date AS d, COALESCE(SUM(p.amount), 0) AS rev
                FROM payments p CROSS JOIN bounds b
                WHERE COALESCE(p.status, 'completed') IN ('completed', 'completed_vip')
                  AND p.created_at >= b.avg7_start AND p.created_at < b.today_start
                GROUP BY 1
            )
            SELECT
                (SELECT COALESCE(SUM(amount), 0)::numeric(12,2) FROM payments WHERE COALESCE(status, 'completed') IN ('completed', 'completed_vip')) AS total_revenue,
                (SELECT COALESCE(SUM(amount), 0)::numeric(12,2) FROM payments p CROSS JOIN bounds b WHERE COALESCE(status, 'completed') IN ('completed', 'completed_vip') AND p.created_at >= b.today_start) AS today_revenue,
                (SELECT COUNT(*)::int FROM payments p CROSS JOIN bounds b WHERE COALESCE(status, 'completed') IN ('completed', 'completed_vip') AND p.created_at >= b.today_start) AS today_orders,
                (SELECT COUNT(DISTINCT user_id)::int FROM payments p CROSS JOIN bounds b WHERE COALESCE(status, 'completed') IN ('completed', 'completed_vip') AND p.created_at >= b.today_start) AS today_paying_users,
                (SELECT COALESCE(SUM(amount), 0)::numeric(12,2) FROM payments p CROSS JOIN bounds b WHERE COALESCE(status, 'completed') IN ('completed', 'completed_vip') AND p.created_at >= b.yesterday_start AND p.created_at < b.today_start) AS yesterday_revenue,
                (SELECT COALESCE(AVG(rev), 0)::numeric(12,2) FROM daily_7d) AS avg7_daily_revenue,
                (SELECT COUNT(*)::int FROM daily_7d) AS avg7_active_days
        `),

        db.query(`
            WITH bounds AS (
                SELECT
                    (date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS today_start,
                    ((date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '1 day') AT TIME ZONE '${TR_TZ}') AS yesterday_start,
                    ((date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '7 days') AT TIME ZONE '${TR_TZ}') AS avg7_start
            ),
            daily_7d AS (
                SELECT ${toTrTs('u.created_at')}::date AS d, COUNT(*)::int AS cnt
                FROM users u CROSS JOIN bounds b
                WHERE u.role = 'user' AND COALESCE(u.account_status, 'active') != 'deleted'
                  AND u.created_at >= b.avg7_start AND u.created_at < b.today_start
                GROUP BY 1
            )
            SELECT
                (SELECT COUNT(*)::int FROM users u CROSS JOIN bounds b WHERE u.role = 'user' AND COALESCE(u.account_status, 'active') != 'deleted' AND u.created_at >= b.today_start) AS today_registrations,
                (SELECT COUNT(*)::int FROM users u CROSS JOIN bounds b WHERE u.role = 'user' AND COALESCE(u.account_status, 'active') != 'deleted' AND u.created_at >= b.yesterday_start AND u.created_at < b.today_start) AS yesterday_registrations,
                (SELECT COALESCE(AVG(cnt), 0)::numeric(12,2) FROM daily_7d) AS avg7_daily_registrations,
                (SELECT COUNT(*)::int FROM daily_7d) AS avg7_active_days
        `),

        db.query(`
            SELECT
                COUNT(*) FILTER (WHERE COALESCE(balance, 0) <= 0)::int AS zero_coin_users,
                COUNT(*) FILTER (WHERE COALESCE(is_premium, false) = true AND (premium_expire_date IS NULL OR premium_expire_date > NOW()))::int AS active_premium_users
            FROM users
            WHERE role = 'user' AND COALESCE(account_status, 'active') != 'deleted'
        `),

        db.query(`
            WITH bounds AS (
                SELECT (date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS today_start
            )
            SELECT COALESCE(NULLIF(TRIM(p.package_name_snapshot), ''), cp.name, 'Paket') AS name, COUNT(*)::int AS cnt
            FROM payments p
            LEFT JOIN coin_packages cp ON p.package_id = cp.id
            CROSS JOIN bounds b
            WHERE COALESCE(p.status, 'completed') IN ('completed', 'completed_vip')
              AND p.created_at >= b.today_start
            GROUP BY 1
            ORDER BY cnt DESC, SUM(p.amount) DESC
            LIMIT 1
        `),

        db.query(`SELECT COUNT(*)::int AS c FROM reports WHERE COALESCE(status, 'pending') IN ('pending', 'open')`),
        db.query(`SELECT COUNT(*)::int AS c FROM payouts WHERE COALESCE(status, 'pending') = 'pending'`),
        schema.hasDeletionRequestsTable
            ? db.query(`SELECT COUNT(*)::int AS c FROM deletion_requests WHERE COALESCE(status, 'pending') = 'pending'`)
            : db.query(`SELECT COUNT(*)::int AS c FROM users WHERE COALESCE(account_status, 'active') = 'deletion_requested' OR COALESCE(admin_notes, '') ILIKE '%[WEB DELETION REQUEST:%'`),
        db.query(`SELECT TO_CHAR(NOW() AT TIME ZONE '${TR_TZ}', 'YYYY-MM-DD') AS tr_date, TO_CHAR(NOW() AT TIME ZONE '${TR_TZ}', 'DD.MM.YYYY') AS tr_date_display`),

        // Detaylı günlük + genel ARPU, ARPPU, DAU, mesaj, cinsiyet, ilk 30dk, kohort
        db.query(`
            WITH bounds AS (
                SELECT (date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS today_start
            ),
            buyer_totals AS (
                SELECT user_id::text AS uid, COUNT(*)::int AS orders
                FROM payments
                WHERE COALESCE(status, 'completed') IN ('completed', 'completed_vip')
                GROUP BY user_id::text
            ),
            today_cohort AS (
                SELECT u.id,
                       u.onboarding_completed,
                       u.gender,
                       (SELECT MIN(p.created_at) FROM payments p WHERE p.user_id::text = u.id::text AND COALESCE(p.status, 'completed') IN ('completed', 'completed_vip')) AS first_pay_at,
                       u.created_at AS reg_at
                FROM users u CROSS JOIN bounds b
                WHERE u.role = 'user' AND COALESCE(u.account_status, 'active') != 'deleted' AND u.created_at >= b.today_start
            )
            SELECT
                (SELECT COUNT(*)::int FROM users WHERE role = 'user' AND COALESCE(account_status, 'active') != 'deleted') AS total_users,
                (SELECT COUNT(*)::int FROM buyer_totals) AS total_paying_users,
                (SELECT COUNT(*)::int FROM buyer_totals WHERE orders >= 2) AS total_repeat_buyers,
                (SELECT COUNT(*)::int FROM payments WHERE COALESCE(status, 'completed') IN ('completed', 'completed_vip')) AS total_orders,
                (SELECT COUNT(*)::int FROM users u CROSS JOIN bounds b WHERE u.role = 'user' AND COALESCE(u.account_status, 'active') != 'deleted' AND COALESCE(u.last_login_at, u.created_at) >= b.today_start) AS today_dau,
                (SELECT COUNT(*)::int FROM messages m JOIN users u ON m.sender_id = u.id CROSS JOIN bounds b WHERE u.role = 'user' AND m.created_at >= b.today_start) AS today_messages,
                (SELECT COUNT(DISTINCT m.sender_id)::int FROM messages m JOIN users u ON m.sender_id = u.id CROSS JOIN bounds b WHERE u.role = 'user' AND m.created_at >= b.today_start) AS today_messaged_users,
                (SELECT COUNT(*)::int FROM today_cohort WHERE onboarding_completed = true) AS today_onboarded,
                (SELECT COUNT(*)::int FROM today_cohort WHERE LOWER(COALESCE(gender, '')) IN ('erkek', 'male')) AS today_male,
                (SELECT COUNT(*)::int FROM today_cohort WHERE LOWER(COALESCE(gender, '')) IN ('kadin', 'kadın', 'female')) AS today_female,
                (SELECT COUNT(*)::int FROM today_cohort WHERE first_pay_at IS NOT NULL) AS today_cohort_paying,
                (SELECT COUNT(*)::int FROM today_cohort WHERE first_pay_at IS NOT NULL AND first_pay_at <= reg_at + INTERVAL '30 minutes') AS today_within_30m
        `),

        db.query(`
            WITH bounds AS (
                SELECT (date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS today_start
            )
            SELECT COALESCE(NULLIF(TRIM(p.package_name_snapshot), ''), cp.name, 'Paket') AS name,
                   COUNT(*)::int AS cnt,
                   COALESCE(SUM(p.amount), 0)::numeric(12,2) AS rev
            FROM payments p
            LEFT JOIN coin_packages cp ON p.package_id = cp.id
            CROSS JOIN bounds b
            WHERE COALESCE(p.status, 'completed') IN ('completed', 'completed_vip')
              AND p.created_at >= b.today_start
            GROUP BY 1
            ORDER BY cnt DESC, SUM(p.amount) DESC
            LIMIT 3
        `)
    ]);

    const r = revRes.rows[0] || {};
    const g = regRes.rows[0] || {};
    const m = miscRes.rows[0] || {};
    const d = detailStatsRes.rows[0] || {};

    const todayRevenue = toNet(r.today_revenue || 0);
    const yesterdayRevenue = toNet(r.yesterday_revenue || 0);
    const avg7Revenue = toNet(r.avg7_daily_revenue || 0);
    const todayRegistrations = g.today_registrations || 0;
    const yesterdayRegistrations = g.yesterday_registrations || 0;
    const avg7Registrations = parseFloat(g.avg7_daily_registrations || 0);
    const todayPayingUsers = r.today_paying_users || 0;
    const todayOrders = r.today_orders || 0;
    const totalRevenue = toNet(r.total_revenue || 0);
    const totalUsers = d.total_users || 0;
    const totalPayingUsers = d.total_paying_users || 0;
    const totalRepeatBuyers = d.total_repeat_buyers || 0;
    const totalOrders = d.total_orders || 0;
    const todayDau = d.today_dau || 0;

    let todayAdSpend = 0;
    let lockedToday = { sent: 0, unlocked: 0, conversions: 0 };
    try {
        const optFlags = await db.query(`
            SELECT to_regclass('public.ad_spends') IS NOT NULL AS has_ad,
                   to_regclass('public.locked_photo_deliveries') IS NOT NULL AS has_locked
        `);
        const fl = optFlags.rows[0] || {};
        if (fl.has_ad) {
            const adR = await db.query('SELECT COALESCE(SUM(amount), 0)::numeric(12,2) AS s FROM ad_spends WHERE spend_date = $1', [trDateRes.rows[0].tr_date]);
            todayAdSpend = Number(parseFloat(adR.rows[0]?.s || 0).toFixed(2));
        }
        if (fl.has_locked) {
            const lkR = await db.query(
                `SELECT COUNT(*) FILTER (WHERE trigger_type != 'manual_test')::int AS sent,
                        COUNT(*) FILTER (WHERE is_unlocked = true AND trigger_type != 'manual_test')::int AS unlocked,
                        COUNT(*) FILTER (WHERE converted_to_purchase = true AND trigger_type != 'manual_test')::int AS conversions
                 FROM locked_photo_deliveries
                 WHERE (created_at AT TIME ZONE '${TR_TZ}')::date = $1`,
                [trDateRes.rows[0].tr_date]
            );
            lockedToday = lkR.rows[0] || lockedToday;
        }
    } catch (_) {}

    const pct = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : (cur > 0 ? 100 : 0));
    const round2 = (v) => Number((v || 0).toFixed(2));

    return {
        trDate: trDateRes.rows[0].tr_date,
        trDateDisplay: trDateRes.rows[0].tr_date_display,
        todayRevenue,
        grossTodayRevenue: Number(parseFloat(r.today_revenue || 0).toFixed(2)),
        todayOrders,
        todayPayingUsers,
        totalRevenue,
        grossTotalRevenue: Number(parseFloat(r.total_revenue || 0).toFixed(2)),
        yesterdayRevenue,
        revenueVsYesterdayPct: pct(todayRevenue, yesterdayRevenue),
        avg7Revenue,
        revenueVsAvg7Pct: avg7Revenue > 0 ? pct(todayRevenue, avg7Revenue) : null,
        avg7RevenueDays: r.avg7_active_days || 0,
        todayRegistrations,
        yesterdayRegistrations,
        registrationsVsYesterdayPct: pct(todayRegistrations, yesterdayRegistrations),
        avg7Registrations,
        registrationsVsAvg7Pct: avg7Registrations > 0 ? pct(todayRegistrations, avg7Registrations) : null,
        avg7RegDays: g.avg7_active_days || 0,
        todayConversionPct: todayRegistrations > 0 ? Number(((todayPayingUsers / todayRegistrations) * 100).toFixed(1)) : 0,
        todayCohortPaying: d.today_cohort_paying || 0,
        todayCohortConversionPct: todayRegistrations > 0 ? Number((((d.today_cohort_paying || 0) / todayRegistrations) * 100).toFixed(1)) : 0,
        todayWithin30mPct: todayRegistrations > 0 ? Number((((d.today_within_30m || 0) / todayRegistrations) * 100).toFixed(1)) : 0,
        todayMale: d.today_male || 0,
        todayFemale: d.today_female || 0,
        todayOnboarded: d.today_onboarded || 0,
        todayDau,
        todayMessages: d.today_messages || 0,
        todayMessagedUsers: d.today_messaged_users || 0,
        totalUsers,
        totalPayingUsers,
        totalRepeatBuyers,
        overallConversionPct: totalUsers > 0 ? Number(((totalPayingUsers / totalUsers) * 100).toFixed(1)) : 0,
        overallRepeatPct: totalPayingUsers > 0 ? Number(((totalRepeatBuyers / totalPayingUsers) * 100).toFixed(1)) : 0,
        todayArpuReg: todayRegistrations > 0 ? round2(todayRevenue / todayRegistrations) : 0,
        todayArpuDau: todayDau > 0 ? round2(todayRevenue / todayDau) : 0,
        todayArppu: todayPayingUsers > 0 ? round2(todayRevenue / todayPayingUsers) : 0,
        todayAov: todayOrders > 0 ? round2(todayRevenue / todayOrders) : 0,
        overallArpu: totalUsers > 0 ? round2(totalRevenue / totalUsers) : 0,
        overallArppu: totalPayingUsers > 0 ? round2(totalRevenue / totalPayingUsers) : 0,
        overallAov: totalOrders > 0 ? round2(totalRevenue / totalOrders) : 0,
        todayAdSpend,
        todayRoas: todayAdSpend > 0 ? round2(todayRevenue / todayAdSpend) : null,
        lockedToday,
        topPackagesToday: topPackagesTodayRes.rows.map((p) => ({
            name: p.name,
            cnt: p.cnt,
            revenue: toNet(p.rev),
        })),
        zeroCoinUsers: m.zero_coin_users || 0,
        activePremiumUsers: m.active_premium_users || 0,
        pendingReports: pendingSupportRes.rows[0]?.c || 0,
        pendingWithdrawals: pendingWithdrawalsRes.rows[0]?.c || 0,
        pendingDeletionRequests: pendingDeletionRes.rows[0]?.c || 0,
        topPackageToday: topPkgRes.rows[0]?.name || '-',
    };
}

function renderDailySummaryEmail(data) {
    const fmtTl = (v) => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtDelta = (v) => (v == null ? 'veri yok' : `${v >= 0 ? '+' : ''}${v}%`);
    const topPkgsText = Array.isArray(data.topPackagesToday) && data.topPackagesToday.length > 0
        ? data.topPackagesToday.map((p, i) => `${i + 1}) ${p.name} (${p.cnt} ad / ${fmtTl(p.revenue)})`).join(' • ')
        : data.topPackageToday;

    const text = [
        `📊 Fiora Detaylı Gün Sonu Özeti (${data.trDateDisplay})`,
        `────────────────────────────────────────`,
        `💰 GELİR & SİPARİŞ`,
        `• Bugün Ciro: ${fmtTl(data.todayRevenue)} Net (Brüt: ${fmtTl(data.grossTodayRevenue)})`,
        `• Sipariş / Ödeyen: ${data.todayOrders} sipariş • ${data.todayPayingUsers} kişi (Dün: ${fmtDelta(data.revenueVsYesterdayPct)} | 7g ort: ${fmtTl(data.avg7Revenue)})`,
        `• Toplam Gelir: ${fmtTl(data.totalRevenue)} Net (Brüt: ${fmtTl(data.grossTotalRevenue)})`,
        ``,
        `📐 ARPU / ARPPU & BİRİM EKONOMİ`,
        `• Bugün ARPU (Kayıt): ${fmtTl(data.todayArpuReg)} | Bugün ARPU (DAU): ${fmtTl(data.todayArpuDau)}`,
        `• Bugün ARPPU: ${fmtTl(data.todayArppu)} | Bugün Ort. Sepet (AOV): ${fmtTl(data.todayAov)}`,
        `• Genel ARPU: ${fmtTl(data.overallArpu)} | Genel ARPPU: ${fmtTl(data.overallArppu)} | Genel AOV: ${fmtTl(data.overallAov)}`,
        `• İlk 30dk Ödeme: %${data.todayWithin30mPct}`,
        ``,
        `👥 KAYIT & DÖNÜŞÜM`,
        `• Bugünkü Kayıt: ${data.todayRegistrations} (Erkek: ${data.todayMale} | Kadın: ${data.todayFemale} | Dün: ${fmtDelta(data.registrationsVsYesterdayPct)} | 7g ort: ${data.avg7Registrations})`,
        `• Profil Tamamlayan: ${data.todayOnboarded} | Bugün Kayıtlardan Ödeyen: ${data.todayCohortPaying} kişi (%${data.todayCohortConversionPct})`,
        `• Toplam Üye: ${data.totalUsers} | Genel Dönüşüm: %${data.overallConversionPct} (${data.totalPayingUsers} ödeyen) | Tekrar Alım: %${data.overallRepeatPct}`,
        ``,
        `🔥 AKTİVİTE & OPERASYON`,
        `• Bugün Aktif Üye (DAU): ${data.todayDau} | Kullanıcı Mesajı: ${data.todayMessages} (${data.todayMessagedUsers} üye)`,
        `• Coin'i Biten: ${data.zeroCoinUsers} | Aktif Premium: ${data.activePremiumUsers}`,
        ...(data.lockedToday?.sent > 0 ? [`• Kilitli Foto Oto (Bugün): ${data.lockedToday.sent} gönderim • ${data.lockedToday.unlocked} açılma • ${data.lockedToday.conversions} satış`] : []),
        ...(data.todayAdSpend > 0 ? [`• Reklam Harcaması: ${fmtTl(data.todayAdSpend)} | ROAS: ${data.todayRoas}x`] : []),
        `• Bekleyen İşlemler: Şikayet ${data.pendingReports} | Para Çekme ${data.pendingWithdrawals} | Silme ${data.pendingDeletionRequests}`,
        `• Bugün En Çok Satanlar: ${topPkgsText}`
    ].join('\n');

    const html = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><title>Fiora Gün Sonu Özeti (${data.trDateDisplay})</title></head>
<body style="margin:0;padding:24px;background:#020617;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:680px;margin:0 auto;background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:24px;">
    <div style="font-size:11px;letter-spacing:2px;color:#60a5fa;text-transform:uppercase;font-weight:bold;">Falka Executive • Detaylı Gün Sonu Özeti</div>
    <h1 style="margin:6px 0 4px;font-size:22px;color:#ffffff;">Günlük Performans Raporu (${data.trDateDisplay})</h1>
    <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;">Europe/Istanbul saatine göre bugünkü tam KPI özeti, ARPU/ARPPU ve son 7 gün kıyası</p>

    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:9px;border-bottom:1px solid #1e293b;color:#94a3b8;">Bugünkü Gelir (Net / Brüt)</td><td style="padding:9px;border-bottom:1px solid #1e293b;text-align:right;font-weight:bold;color:#34d399;">${fmtTl(data.todayRevenue)} / ${fmtTl(data.grossTodayRevenue)} (${data.todayOrders} sipariş • ${data.todayPayingUsers} kişi)</td></tr>
      <tr><td style="padding:9px;border-bottom:1px solid #1e293b;color:#94a3b8;">Düne / 7g Ort. Göre Gelir</td><td style="padding:9px;border-bottom:1px solid #1e293b;text-align:right;color:#e2e8f0;">${fmtDelta(data.revenueVsYesterdayPct)} dün • 7g ort: ${fmtTl(data.avg7Revenue)}</td></tr>
      <tr><td style="padding:9px;border-bottom:1px solid #1e293b;color:#94a3b8;">Toplam Gelir (Net / Brüt)</td><td style="padding:9px;border-bottom:1px solid #1e293b;text-align:right;font-weight:bold;color:#ffffff;">${fmtTl(data.totalRevenue)} / ${fmtTl(data.grossTotalRevenue)}</td></tr>
      <tr><td style="padding:9px;border-bottom:1px solid #1e293b;color:#94a3b8;">Bugün ARPU (Kayıt / DAU)</td><td style="padding:9px;border-bottom:1px solid #1e293b;text-align:right;font-weight:bold;color:#38bdf8;">${fmtTl(data.todayArpuReg)} / ${fmtTl(data.todayArpuDau)}</td></tr>
      <tr><td style="padding:9px;border-bottom:1px solid #1e293b;color:#94a3b8;">Bugün ARPPU / Ort. Sepet (AOV)</td><td style="padding:9px;border-bottom:1px solid #1e293b;text-align:right;font-weight:bold;color:#fbbf24;">${fmtTl(data.todayArppu)} / ${fmtTl(data.todayAov)}</td></tr>
      <tr><td style="padding:9px;border-bottom:1px solid #1e293b;color:#94a3b8;">Genel ARPU / ARPPU / AOV</td><td style="padding:9px;border-bottom:1px solid #1e293b;text-align:right;color:#e2e8f0;">${fmtTl(data.overallArpu)} / ${fmtTl(data.overallArppu)} / ${fmtTl(data.overallAov)}</td></tr>
      <tr><td style="padding:9px;border-bottom:1px solid #1e293b;color:#94a3b8;">Bugünkü Kayıt (E / K)</td><td style="padding:9px;border-bottom:1px solid #1e293b;text-align:right;font-weight:bold;color:#60a5fa;">${data.todayRegistrations} (${data.todayMale}E / ${data.todayFemale}K • ${fmtDelta(data.registrationsVsYesterdayPct)} dün • 7g ort: ${data.avg7Registrations})</td></tr>
      <tr><td style="padding:9px;border-bottom:1px solid #1e293b;color:#94a3b8;">Bugün Kayıt Dönüşümü & İlk 30dk</td><td style="padding:9px;border-bottom:1px solid #1e293b;text-align:right;color:#e2e8f0;">${data.todayCohortPaying} kişi (%${data.todayCohortConversionPct}) • İlk 30dk: %${data.todayWithin30mPct}</td></tr>
      <tr><td style="padding:9px;border-bottom:1px solid #1e293b;color:#94a3b8;">Toplam Üye / Genel Dönüşüm / Tekrar</td><td style="padding:9px;border-bottom:1px solid #1e293b;text-align:right;color:#e2e8f0;">${data.totalUsers} üye • %${data.overallConversionPct} (${data.totalPayingUsers}) • Tekrar: %${data.overallRepeatPct}</td></tr>
      <tr><td style="padding:9px;border-bottom:1px solid #1e293b;color:#94a3b8;">Bugün Aktif (DAU) & Kullanıcı Mesajı</td><td style="padding:9px;border-bottom:1px solid #1e293b;text-align:right;color:#e2e8f0;">${data.todayDau} aktif üye • ${data.todayMessages} mesaj (${data.todayMessagedUsers} üye)</td></tr>
      <tr><td style="padding:9px;border-bottom:1px solid #1e293b;color:#94a3b8;">Coin'i Biten / Aktif Premium</td><td style="padding:9px;border-bottom:1px solid #1e293b;text-align:right;color:#f87171;">${data.zeroCoinUsers} coin bitti • <span style="color:#c084fc;">${data.activePremiumUsers} premium</span></td></tr>
      ${data.lockedToday?.sent > 0 ? `<tr><td style="padding:9px;border-bottom:1px solid #1e293b;color:#94a3b8;">Kilitli Foto Oto (Bugün)</td><td style="padding:9px;border-bottom:1px solid #1e293b;text-align:right;color:#f472b6;">${data.lockedToday.sent} gönderim • ${data.lockedToday.unlocked} açılma • ${data.lockedToday.conversions} satış</td></tr>` : ''}
      ${data.todayAdSpend > 0 ? `<tr><td style="padding:9px;border-bottom:1px solid #1e293b;color:#94a3b8;">Reklam Harcaması / ROAS</td><td style="padding:9px;border-bottom:1px solid #1e293b;text-align:right;color:#34d399;">${fmtTl(data.todayAdSpend)} • ${data.todayRoas}x</td></tr>` : ''}
      <tr><td style="padding:9px;border-bottom:1px solid #1e293b;color:#94a3b8;">Bekleyen İşlemler</td><td style="padding:9px;border-bottom:1px solid #1e293b;text-align:right;color:#e2e8f0;">Şikayet: ${data.pendingReports} • Çekim: ${data.pendingWithdrawals} • Silme: ${data.pendingDeletionRequests}</td></tr>
      <tr><td style="padding:9px;color:#94a3b8;">Bugün En Çok Satan Paketler</td><td style="padding:9px;text-align:right;color:#e2e8f0;">${topPkgsText}</td></tr>
    </table>
  </div>
</body>
</html>`;

    return {
        subject: `[Fiora] Gün Sonu Özeti (${data.trDateDisplay}) — ${fmtTl(data.todayRevenue)} / ${data.todayRegistrations} Kayıt`,
        html,
        text
    };
}

async function sendMailIfConfigured({ subject, html, text }) {
    const cfg = getEmailTransportConfig();
    if (!cfg.configured) {
        return { sent: false, previewOnly: true, reason: `SMTP kimlik bilgileri eksik (${cfg.missingVars.join(', ')})`, recipient: cfg.summaryTo };
    }

    const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass }
    });

    await transporter.sendMail({
        from: cfg.mailFrom,
        to: cfg.summaryTo,
        subject,
        text,
        html
    });
    return { sent: true, previewOnly: false, recipient: cfg.summaryTo };
}

async function evaluateThresholdAlerts(db, data, { isEndOfDay = false } = {}) {
    const schema = await getSchemaAvailability(db);
    const settings = await getAlertSettings(db);
    const triggered = [];

    const candidates = [];
    if (isEndOfDay && data.avg7Revenue > 0 && data.avg7RevenueDays >= 3) {
        const minExpected = data.avg7Revenue * (settings.alert_revenue_drop_pct / 100);
        if (data.todayRevenue < minExpected) {
            candidates.push({
                key: 'revenue_drop',
                title: 'Günlük Gelir Düşüş Alarmı',
                metric: data.todayRevenue,
                threshold: Number(minExpected.toFixed(2)),
                message: `Bugünkü gelir (₺${data.todayRevenue}) son 7 gün ortalamasının (₺${data.avg7Revenue}) %${settings.alert_revenue_drop_pct} altına düştü.`
            });
        }
    }

    if (data.avg7Registrations > 0 && data.avg7RegDays >= 3) {
        const spikeCap = data.avg7Registrations * settings.alert_signup_spike_mult;
        if (data.todayRegistrations > spikeCap) {
            candidates.push({
                key: 'signup_spike',
                title: 'Kayıt Patlaması Alarmı',
                metric: data.todayRegistrations,
                threshold: Number(spikeCap.toFixed(1)),
                message: `Bugünkü kayıt (${data.todayRegistrations}) son 7 gün ortalamasının (${data.avg7Registrations}) ${settings.alert_signup_spike_mult} katını aştı.`
            });
        }
    }

    if (data.pendingReports > settings.alert_pending_support_limit) {
        candidates.push({
            key: 'support_backlog',
            title: 'Bekleyen Destek Yoğunluğu Alarmı',
            metric: data.pendingReports,
            threshold: settings.alert_pending_support_limit,
            message: `Bekleyen şikayet/rapor sayısı (${data.pendingReports}) eşik değerini (${settings.alert_pending_support_limit}) aştı.`
        });
    }

    for (const c of candidates) {
        if (schema.hasAlertLogs) {
            const existing = await db.query(
                'SELECT id FROM alert_dispatch_logs WHERE alert_date = $1 AND alert_key = $2',
                [data.trDate, c.key]
            );
            if (existing.rows.length > 0) continue; // Günde en fazla bir kez
        }

        const mailRes = await sendMailIfConfigured({
            subject: `[Fiora ALARM] ${c.title} (${data.trDateDisplay})`,
            text: c.message,
            html: `<div style="font-family:Arial;padding:20px;background:#0f172a;color:#f8fafc;border-radius:12px;"><h2>${c.title}</h2><p>${c.message}</p><p style="color:#94a3b8;font-size:12px;">Tarih: ${data.trDateDisplay}</p></div>`
        });

        const logStatus = mailRes.sent ? 'sent' : 'preview_only';
        if (schema.hasAlertLogs) {
            await db.query(
                `INSERT INTO alert_dispatch_logs (alert_date, alert_key, metric_value, threshold_value, status, details)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (alert_date, alert_key) DO NOTHING`,
                [data.trDate, c.key, c.metric, c.threshold, logStatus, c.message]
            );
        }
        triggered.push({ ...c, deliveryStatus: logStatus });
    }

    return { settings, triggered };
}

async function runDailySummaryJob(db, { triggerSource = 'internal_scheduler', isEndOfDay = true, writePreviewFiles = false } = {}) {
    const schema = await getSchemaAvailability(db);
    const data = await buildDailySummaryData(db);
    const email = renderDailySummaryEmail(data);

    // Prevent duplicate scheduled dispatch on the same day (manual_test is allowed anytime)
    if (triggerSource !== 'manual_test' && schema.hasSummaryRuns) {
        const already = await db.query(
            `SELECT id FROM daily_summary_runs WHERE run_date = $1 AND trigger_source != 'manual_test' LIMIT 1`,
            [data.trDate]
        );
        if (already.rows.length > 0) {
            return { skipped: true, reason: 'Bugünkü zamanlanmış özet zaten çalıştırıldı.', data, email };
        }
    }

    const sendRes = await sendMailIfConfigured(email);
    const runStatus = sendRes.sent ? 'sent' : 'preview_only';

    if (schema.hasSummaryRuns) {
        await db.query(
            `INSERT INTO daily_summary_runs (run_date, trigger_source, status, recipient, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [data.trDate, triggerSource, runStatus, sendRes.recipient, sendRes.reason || 'OK']
        );
    }

    if (writePreviewFiles) {
        const previewDir = path.join(__dirname, '..', 'scratch', 'email_previews');
        fs.mkdirSync(previewDir, { recursive: true });
        fs.writeFileSync(path.join(previewDir, 'daily_summary_preview.html'), email.html, 'utf8');
        fs.writeFileSync(path.join(previewDir, 'daily_summary_preview.txt'), `${email.subject}\n\n${email.text}\n`, 'utf8');
    }

    const alertsRes = await evaluateThresholdAlerts(db, data, { isEndOfDay });

    return {
        skipped: false,
        delivery: sendRes,
        data,
        email,
        alerts: alertsRes.triggered
    };
}

async function getSchedulerHealthStatus(db) {
    const schema = await getSchemaAvailability(db);
    const smtp = getEmailTransportConfig();
    const settings = await getAlertSettings(db);

    if (!schema.hasSummaryRuns) {
        return {
            smtpConfigured: smtp.configured,
            missingEnvVars: smtp.missingVars,
            recipient: smtp.summaryTo,
            hasLogsTable: false,
            todayRunCount: 0,
            yesterdayMissed: false,
            recentRuns: [],
            recentAlerts: [],
            settings,
        };
    }

    const [todayRes, yestRes, runsRes, alertsRes] = await Promise.all([
        db.query(`SELECT COUNT(*)::int AS c FROM daily_summary_runs WHERE run_date = (NOW() AT TIME ZONE '${TR_TZ}')::date`),
        db.query(`SELECT COUNT(*)::int AS c FROM daily_summary_runs WHERE run_date = ((NOW() AT TIME ZONE '${TR_TZ}')::date - 1)`),
        db.query(`SELECT id, TO_CHAR(run_date, 'YYYY-MM-DD') AS run_date, trigger_source, status, recipient, details, created_at FROM daily_summary_runs ORDER BY created_at DESC LIMIT 15`),
        schema.hasAlertLogs
            ? db.query(`SELECT id, TO_CHAR(alert_date, 'YYYY-MM-DD') AS alert_date, alert_key, metric_value, threshold_value, status, details, created_at FROM alert_dispatch_logs ORDER BY created_at DESC LIMIT 15`)
            : Promise.resolve({ rows: [] })
    ]);

    return {
        smtpConfigured: smtp.configured,
        missingEnvVars: smtp.missingVars,
        recipient: smtp.summaryTo,
        hasLogsTable: true,
        todayRunCount: todayRes.rows[0]?.c || 0,
        yesterdayMissed: (yestRes.rows[0]?.c || 0) === 0,
        recentRuns: runsRes.rows,
        recentAlerts: alertsRes.rows,
        settings,
    };
}

let schedulerTimer = null;
function startDailySummaryScheduler(db) {
    if (schedulerTimer) return;
    schedulerTimer = setInterval(async () => {
        try {
            const nowRes = await db.query(`
                SELECT EXTRACT(HOUR FROM NOW() AT TIME ZONE '${TR_TZ}')::int AS hr,
                       EXTRACT(MINUTE FROM NOW() AT TIME ZONE '${TR_TZ}')::int AS mn
            `);
            const { hr, mn } = nowRes.rows[0] || {};
            if (hr === 22 && mn <= 5) {
                await runDailySummaryJob(db, { triggerSource: 'internal_scheduler', isEndOfDay: true });
            } else {
                // Real-time spike/support check without waiting for 22:00
                const data = await buildDailySummaryData(db);
                await evaluateThresholdAlerts(db, data, { isEndOfDay: false });
            }
        } catch (err) {
            console.warn('[DAILY SUMMARY SCHEDULER]', err.message);
        }
    }, 5 * 60 * 1000);
    if (typeof schedulerTimer.unref === 'function') schedulerTimer.unref();
}

module.exports = {
    getEmailTransportConfig,
    getAlertSettings,
    buildDailySummaryData,
    renderDailySummaryEmail,
    runDailySummaryJob,
    getSchedulerHealthStatus,
    startDailySummaryScheduler,
};
