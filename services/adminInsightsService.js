const TR_TZ = 'Europe/Istanbul';
const NET_FACTOR = 0.65; // Google Play / vergi (%35 kesinti sonrası net gelir)
const toNet = (v) => Number((parseFloat(v || 0) * NET_FACTOR).toFixed(2));

const toTrTs = (col) => `((${col}) AT TIME ZONE 'UTC' AT TIME ZONE '${TR_TZ}')`;

async function getSchemaAvailability(db) {
    const [tblRes, userColsRes] = await Promise.all([
        db.query(
            `SELECT tablename FROM pg_tables
             WHERE schemaname = 'public'
               AND tablename = ANY($1::text[])`,
            [[
                'user_sessions',
                'ad_spends',
                'subscription_events',
                'admin_alert_settings',
                'daily_summary_runs',
                'alert_dispatch_logs',
                'monthly_targets',
                'deletion_requests'
            ]]
        ),
        db.query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'users'
               AND column_name = ANY($1::text[])`,
            [['acquisition_source', 'utm_source', 'utm_medium', 'utm_campaign', 'install_referrer', 'app_version', 'last_login_at']]
        )
    ]);

    const tables = new Set(tblRes.rows.map((r) => r.tablename));
    const userCols = new Set(userColsRes.rows.map((r) => r.column_name));

    return {
        hasUserSessions: tables.has('user_sessions'),
        hasAdSpends: tables.has('ad_spends'),
        hasSubscriptionEvents: tables.has('subscription_events'),
        hasAlertSettings: tables.has('admin_alert_settings'),
        hasSummaryRuns: tables.has('daily_summary_runs'),
        hasAlertLogs: tables.has('alert_dispatch_logs'),
        hasMonthlyTargets: tables.has('monthly_targets'),
        hasDeletionRequestsTable: tables.has('deletion_requests'),
        hasAcquisitionCols: userCols.has('acquisition_source'),
        hasAppVersionCol: userCols.has('app_version'),
        hasLastLoginAt: userCols.has('last_login_at'),
    };
}

function pctDelta(cur, prev) {
    const c = Number(cur || 0);
    const p = Number(prev || 0);
    if (p <= 0) return c > 0 ? 100 : 0;
    return Math.round(((c - p) / p) * 100);
}

/**
 * 1) RETENTION OVERVIEW + 8-WEEK COHORTS (D1 / D7 / D30)
 */
async function getRetentionOverview(db, days = 30) {
    const safeDays = Math.min(365, Math.max(1, parseInt(days, 10) || 30));
    const schema = await getSchemaAvailability(db);

    let sessionRowCount = 0;
    if (schema.hasUserSessions) {
        const cntRes = await db.query('SELECT COUNT(*)::int AS c FROM user_sessions');
        sessionRowCount = cntRes.rows[0]?.c || 0;
    }
    const useExactSessions = schema.hasUserSessions && sessionRowCount > 0;
    const lastSeenExpr = schema.hasLastLoginAt ? 'COALESCE(u.last_login_at, u.created_at)' : 'u.created_at';

    const [
        summaryRes,
        returningRes,
        dailySignupsRes,
        atRiskRes,
        cohortRes
    ] = await Promise.all([
        db.query(`
            SELECT
                COUNT(*)::int AS total_users,
                COUNT(*) FILTER (WHERE ${lastSeenExpr} >= NOW() - make_interval(days => $1))::int AS active_users,
                COUNT(*) FILTER (WHERE ${lastSeenExpr} >= NOW() - INTERVAL '1 day')::int AS dau,
                COUNT(*) FILTER (WHERE ${lastSeenExpr} >= NOW() - INTERVAL '7 days')::int AS wau,
                COUNT(*) FILTER (WHERE ${lastSeenExpr} < NOW() - INTERVAL '30 days')::int AS churned_users
            FROM users u
            WHERE u.role = 'user' AND COALESCE(u.account_status, 'active') != 'deleted'
        `, [safeDays]),

        db.query(`
            SELECT COUNT(*)::int AS returning_users
            FROM users u
            WHERE u.role = 'user'
              AND COALESCE(u.account_status, 'active') != 'deleted'
              AND u.created_at < NOW() - INTERVAL '7 days'
              AND ${lastSeenExpr} >= NOW() - INTERVAL '7 days'
        `),

        db.query(`
            SELECT ${toTrTs('u.created_at')}::date AS date, COUNT(*)::int AS count
            FROM users u
            WHERE u.role = 'user'
              AND COALESCE(u.account_status, 'active') != 'deleted'
              AND u.created_at >= NOW() - INTERVAL '14 days'
            GROUP BY 1
            ORDER BY 1 DESC
        `),

        db.query(`
            SELECT u.id, u.username, u.display_name, COALESCE(u.balance, 0) AS balance,
                   u.last_login_at AS last_login
            FROM users u
            WHERE u.role = 'user'
              AND COALESCE(u.account_status, 'active') != 'deleted'
              AND u.last_login_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '7 days'
            ORDER BY u.last_login_at DESC
            LIMIT 20
        `),

        useExactSessions
            ? db.query(`
                WITH weeks AS (
                    SELECT generate_series(
                        date_trunc('week', NOW() AT TIME ZONE '${TR_TZ}')::date - INTERVAL '7 weeks',
                        date_trunc('week', NOW() AT TIME ZONE '${TR_TZ}')::date,
                        INTERVAL '1 week'
                    )::date AS week_start
                ),
                u_reg AS (
                    SELECT
                        u.id,
                        ${toTrTs('u.created_at')}::date AS reg_date,
                        date_trunc('week', ${toTrTs('u.created_at')})::date AS cohort_week
                    FROM users u
                    WHERE u.role = 'user'
                      AND COALESCE(u.account_status, 'active') != 'deleted'
                      AND ${toTrTs('u.created_at')}::date >= (date_trunc('week', NOW() AT TIME ZONE '${TR_TZ}')::date - INTERVAL '7 weeks')
                )
                SELECT
                    TO_CHAR(w.week_start, 'YYYY-MM-DD') AS week_start,
                    COUNT(u.id)::int AS cohort_size,
                    COUNT(u.id) FILTER (WHERE u.reg_date <= (NOW() AT TIME ZONE '${TR_TZ}')::date - 1)::int AS d1_eligible,
                    COUNT(u.id) FILTER (WHERE u.reg_date <= (NOW() AT TIME ZONE '${TR_TZ}')::date - 1 AND EXISTS (
                        SELECT 1 FROM user_sessions s WHERE s.user_id = u.id AND s.session_date = u.reg_date + 1
                    ))::int AS d1_retained,
                    COUNT(u.id) FILTER (WHERE u.reg_date <= (NOW() AT TIME ZONE '${TR_TZ}')::date - 7)::int AS d7_eligible,
                    COUNT(u.id) FILTER (WHERE u.reg_date <= (NOW() AT TIME ZONE '${TR_TZ}')::date - 7 AND EXISTS (
                        SELECT 1 FROM user_sessions s WHERE s.user_id = u.id AND s.session_date = u.reg_date + 7
                    ))::int AS d7_retained,
                    COUNT(u.id) FILTER (WHERE u.reg_date <= (NOW() AT TIME ZONE '${TR_TZ}')::date - 30)::int AS d30_eligible,
                    COUNT(u.id) FILTER (WHERE u.reg_date <= (NOW() AT TIME ZONE '${TR_TZ}')::date - 30 AND EXISTS (
                        SELECT 1 FROM user_sessions s WHERE s.user_id = u.id AND s.session_date = u.reg_date + 30
                    ))::int AS d30_retained
                FROM weeks w
                LEFT JOIN u_reg u ON u.cohort_week = w.week_start
                GROUP BY w.week_start
                ORDER BY w.week_start DESC
            `)
            : db.query(`
                WITH weeks AS (
                    SELECT generate_series(
                        date_trunc('week', NOW() AT TIME ZONE '${TR_TZ}')::date - INTERVAL '7 weeks',
                        date_trunc('week', NOW() AT TIME ZONE '${TR_TZ}')::date,
                        INTERVAL '1 week'
                    )::date AS week_start
                ),
                u_reg AS (
                    SELECT
                        u.id,
                        ${toTrTs('u.created_at')}::date AS reg_date,
                        date_trunc('week', ${toTrTs('u.created_at')})::date AS cohort_week,
                        ${toTrTs(lastSeenExpr)}::date AS last_seen_date
                    FROM users u
                    WHERE u.role = 'user'
                      AND COALESCE(u.account_status, 'active') != 'deleted'
                      AND ${toTrTs('u.created_at')}::date >= (date_trunc('week', NOW() AT TIME ZONE '${TR_TZ}')::date - INTERVAL '7 weeks')
                )
                SELECT
                    TO_CHAR(w.week_start, 'YYYY-MM-DD') AS week_start,
                    COUNT(u.id)::int AS cohort_size,
                    COUNT(u.id) FILTER (WHERE u.reg_date <= (NOW() AT TIME ZONE '${TR_TZ}')::date - 1)::int AS d1_eligible,
                    COUNT(u.id) FILTER (WHERE u.reg_date <= (NOW() AT TIME ZONE '${TR_TZ}')::date - 1 AND u.last_seen_date >= u.reg_date + 1)::int AS d1_retained,
                    COUNT(u.id) FILTER (WHERE u.reg_date <= (NOW() AT TIME ZONE '${TR_TZ}')::date - 7)::int AS d7_eligible,
                    COUNT(u.id) FILTER (WHERE u.reg_date <= (NOW() AT TIME ZONE '${TR_TZ}')::date - 7 AND u.last_seen_date >= u.reg_date + 7)::int AS d7_retained,
                    COUNT(u.id) FILTER (WHERE u.reg_date <= (NOW() AT TIME ZONE '${TR_TZ}')::date - 30)::int AS d30_eligible,
                    COUNT(u.id) FILTER (WHERE u.reg_date <= (NOW() AT TIME ZONE '${TR_TZ}')::date - 30 AND u.last_seen_date >= u.reg_date + 30)::int AS d30_retained
                FROM weeks w
                LEFT JOIN u_reg u ON u.cohort_week = w.week_start
                GROUP BY w.week_start
                ORDER BY w.week_start DESC
            `)
    ]);

    const s = summaryRes.rows[0] || {};
    const totalUsers = s.total_users || 0;
    const activeUsers = s.active_users || 0;
    const wau = s.wau || 0;

    const cohorts = cohortRes.rows.map((r) => {
        const size = r.cohort_size || 0;
        const makeMetric = (retained, eligible) => ({
            retained,
            eligible,
            mature: eligible > 0,
            ratePct: eligible > 0 ? Number(((retained / eligible) * 100).toFixed(1)) : null,
        });
        return {
            weekStart: r.week_start,
            size,
            lowSample: size < 30,
            d1: makeMetric(r.d1_retained || 0, r.d1_eligible || 0),
            d7: makeMetric(r.d7_retained || 0, r.d7_eligible || 0),
            d30: makeMetric(r.d30_retained || 0, r.d30_eligible || 0),
        };
    });

    return {
        total_users: totalUsers,
        active_users: activeUsers,
        dau: s.dau || 0,
        wau,
        churned_users: s.churned_users || 0,
        returning_users: returningRes.rows[0]?.returning_users || 0,
        retention_rate: activeUsers > 0 ? Math.round((wau / activeUsers) * 100) : 0,
        daily_signups: dailySignupsRes.rows,
        at_risk_users: atRiskRes.rows,
        methodology: {
            approximate: !useExactSessions,
            dataSource: useExactSessions ? 'user_sessions' : 'users.last_login_at',
            hasUserSessionsTable: schema.hasUserSessions,
            accuracyNote: useExactSessions
                ? 'Günlük oturum tablosu (user_sessions) üzerinden kesin gün eşleşmesiyle hesaplanır.'
                : 'Yaklaşık hesaplama: Veritabanında günlük oturum geçmişi (user_sessions) tablosu henüz yok. Yalnızca users.last_login_at (en son giriş/socket bağlantısı) bilindiğinden D(k) = son görülme >= kayıt + k gün olarak tahmin edilir; kullanıcının ara günlerde girip girmediğini kesin ayırmaz.'
        },
        cohorts,
    };
}

/**
 * 2) KAYIT KAYNAĞI VE REKLAM MALİYETİ
 */
async function getAcquisitionOverview(db, days = 30) {
    const safeDays = days === 'all' ? null : Math.min(365, Math.max(1, parseInt(days, 10) || 30));
    const schema = await getSchemaAvailability(db);

    const dateFilter = safeDays ? `AND u.created_at >= NOW() - make_interval(days => $1)` : '';
    const params = safeDays ? [safeDays] : [];

    const sourceExpr = schema.hasAcquisitionCols
        ? `COALESCE(NULLIF(LOWER(TRIM(u.acquisition_source)), ''), CASE WHEN u.referred_by IS NOT NULL THEN 'referans' ELSE 'bilinmiyor' END)`
        : `CASE WHEN u.referred_by IS NOT NULL THEN 'referans' ELSE 'bilinmiyor' END`;

    const sourcesRes = await db.query(`
        WITH user_scope AS (
            SELECT
                u.id,
                ${sourceExpr} AS source_key
            FROM users u
            WHERE u.role = 'user'
              AND COALESCE(u.account_status, 'active') != 'deleted'
              ${dateFilter}
        ),
        user_payments AS (
            SELECT
                p.user_id::text AS uid,
                COUNT(*) FILTER (WHERE COALESCE(p.status, 'completed') IN ('completed', 'completed_vip'))::int AS orders,
                COALESCE(SUM(p.amount) FILTER (WHERE COALESCE(p.status, 'completed') IN ('completed', 'completed_vip')), 0)::numeric(12,2) AS revenue
            FROM payments p
            GROUP BY p.user_id::text
        )
        SELECT
            us.source_key AS source,
            COUNT(*)::int AS registrations,
            COUNT(*) FILTER (WHERE COALESCE(up.orders, 0) > 0)::int AS paying_users,
            COALESCE(SUM(COALESCE(up.revenue, 0)), 0)::numeric(12,2) AS revenue
        FROM user_scope us
        LEFT JOIN user_payments up ON up.uid = us.id::text
        GROUP BY us.source_key
        ORDER BY registrations DESC, revenue DESC
    `, params);

    let spendList = [];
    let spendBySource = new Map();
    if (schema.hasAdSpends) {
        const spendFilter = safeDays ? `WHERE spend_date >= ((NOW() AT TIME ZONE '${TR_TZ}')::date - $1::int)` : '';
        const [listRes, aggRes] = await Promise.all([
            db.query(`
                SELECT id, TO_CHAR(spend_date, 'YYYY-MM-DD') AS spend_date, source, campaign, amount::numeric(12,2), notes, created_at
                FROM ad_spends
                ${spendFilter}
                ORDER BY spend_date DESC, id DESC
                LIMIT 100
            `, params),
            db.query(`
                SELECT LOWER(TRIM(source)) AS source, COALESCE(SUM(amount), 0)::numeric(12,2) AS total_spend
                FROM ad_spends
                ${spendFilter}
                GROUP BY 1
            `, params)
        ]);
        spendList = listRes.rows.map((r) => ({ ...r, amount: parseFloat(r.amount || 0) }));
        aggRes.rows.forEach((r) => spendBySource.set(r.source, parseFloat(r.total_spend || 0)));
    }

    const sourceRows = sourcesRes.rows.map((r) => {
        const registrations = r.registrations || 0;
        const payingUsers = r.paying_users || 0;
        const revenue = toNet(r.revenue || 0);
        const spend = spendBySource.get(String(r.source || '').toLowerCase()) || 0;
        return {
            source: r.source,
            registrations,
            payingUsers,
            revenue,
            conversionPct: registrations > 0 ? Number(((payingUsers / registrations) * 100).toFixed(1)) : 0,
            lowSample: registrations < 30,
            adSpend: spend,
            cac: spend > 0 && registrations > 0 ? Number((spend / registrations).toFixed(2)) : null,
            costPerPayer: spend > 0 && payingUsers > 0 ? Number((spend / payingUsers).toFixed(2)) : null,
            roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : null,
        };
    });

    // Include ad spend sources that had 0 matched registrations so spend never disappears
    for (const [spSource, spAmount] of spendBySource.entries()) {
        if (!sourceRows.some((r) => String(r.source).toLowerCase() === spSource)) {
            sourceRows.push({
                source: spSource,
                registrations: 0,
                payingUsers: 0,
                revenue: 0,
                conversionPct: 0,
                lowSample: true,
                adSpend: spAmount,
                cac: null,
                costPerPayer: null,
                roas: 0,
            });
        }
    }

    const totals = sourceRows.reduce((acc, r) => ({
        registrations: acc.registrations + r.registrations,
        payingUsers: acc.payingUsers + r.payingUsers,
        revenue: Number((acc.revenue + r.revenue).toFixed(2)),
        adSpend: Number((acc.adSpend + r.adSpend).toFixed(2)),
    }), { registrations: 0, payingUsers: 0, revenue: 0, adSpend: 0 });

    return {
        hasAcquisitionCols: schema.hasAcquisitionCols,
        hasAdSpendsTable: schema.hasAdSpends,
        sources: sourceRows,
        adSpends: spendList,
        totals: {
            ...totals,
            conversionPct: totals.registrations > 0 ? Number(((totals.payingUsers / totals.registrations) * 100).toFixed(1)) : 0,
            cac: totals.adSpend > 0 && totals.registrations > 0 ? Number((totals.adSpend / totals.registrations).toFixed(2)) : null,
            costPerPayer: totals.adSpend > 0 && totals.payingUsers > 0 ? Number((totals.adSpend / totals.payingUsers).toFixed(2)) : null,
            roas: totals.adSpend > 0 ? Number((totals.revenue / totals.adSpend).toFixed(2)) : null,
        },
        integrationNotes: {
            statusText: schema.hasAcquisitionCols
                ? 'Kayıt kaynağı alanları veritabanında mevcut. Kayıt API’si utm/kaynak alanlarını kabul etmeye hazır.'
                : 'Mevcut veritabanında kayıt kaynağı alanları (acquisition_source, utm_*, install_referrer) yok; tüm geçmiş kullanıcılar "bilinmiyor" (referred_by varsa "referans") olarak gösteriliyor.',
            mobileOptions: [
                'Google Play Install Referrer (react-native-play-install-referrer): İlk açılışta Meta/Google kampanya UTM parametrelerini okuyup /api/auth/register + /api/auth/google body’sine ekleyin.',
                'Dahili Referans / Influencer Kodu: Zaten mevcut /api/r/:code ve users.referred_by akışı ile bağlayın.',
                'Organik Varsayılan: Referrer ve kod yoksa istemci acquisitionSource: "organic" gönderir.'
            ]
        }
    };
}

/**
 * 3) PREMIUM / ABONELİK YÖNETİMİ
 */
async function getSubscriptionsOverview(db, { excludeTest = true } = {}) {
    const schema = await getSchemaAvailability(db);
    const excludeClause = excludeTest
        ? `AND COALESCE(p.transaction_id, '') NOT ILIKE 'test%'
           AND COALESCE(p.transaction_id, '') NOT ILIKE 'manual_%'
           AND COALESCE(p.payment_method, '') NOT IN ('test', 'manual', 'admin_manual')`
        : '';

    const planCase = `
        CASE
            WHEN LOWER(COALESCE(p.package_name_snapshot, '')) ~ '(1_month|1_ay|1m)' OR COALESCE(p.coin_amount, 0) = 1 THEN '1_month'
            WHEN LOWER(COALESCE(p.package_name_snapshot, '')) ~ '(3_month|3_ay|3m)' OR COALESCE(p.coin_amount, 0) = 3 THEN '3_months'
            WHEN LOWER(COALESCE(p.package_name_snapshot, '')) ~ '(6_month|6_ay|6m)' OR COALESCE(p.coin_amount, 0) = 6 THEN '6_months'
            WHEN ROUND(COALESCE(p.amount, 0)) = 1 THEN '1_month'
            WHEN ROUND(COALESCE(p.amount, 0)) = 3 THEN '3_months'
            WHEN ROUND(COALESCE(p.amount, 0)) = 6 THEN '6_months'
            ELSE 'other'
        END
    `;

    const [activeRes, expiringRes, revenueRes] = await Promise.all([
        db.query(`
            WITH latest_vip_pay AS (
                SELECT DISTINCT ON (p.user_id::text)
                    p.user_id::text AS uid,
                    ${planCase} AS plan_bucket
                FROM payments p
                WHERE p.status = 'completed_vip' ${excludeClause}
                ORDER BY p.user_id::text, p.created_at DESC
            ),
            active_premium AS (
                SELECT u.id, COALESCE(lvp.plan_bucket, 'unspecified') AS plan_bucket
                FROM users u
                LEFT JOIN latest_vip_pay lvp ON lvp.uid = u.id::text
                WHERE u.role = 'user'
                  AND COALESCE(u.account_status, 'active') != 'deleted'
                  AND COALESCE(u.is_premium, false) = true
                  AND (u.premium_expire_date IS NULL OR u.premium_expire_date > NOW())
            )
            SELECT plan_bucket, COUNT(*)::int AS count
            FROM active_premium
            GROUP BY plan_bucket
        `),

        db.query(`
            WITH latest_vip_pay AS (
                SELECT DISTINCT ON (p.user_id::text)
                    p.user_id::text AS uid,
                    p.amount,
                    p.created_at,
                    COALESCE(p.package_name_snapshot, 'Premium') AS package_name
                FROM payments p
                WHERE p.status = 'completed_vip'
                ORDER BY p.user_id::text, p.created_at DESC
            )
            SELECT
                u.id,
                u.username,
                COALESCE(u.display_name, u.name, u.username) AS display_name,
                u.premium_expire_date,
                lvp.amount AS last_payment_amount,
                lvp.created_at AS last_payment_at,
                lvp.package_name
            FROM users u
            LEFT JOIN latest_vip_pay lvp ON lvp.uid = u.id::text
            WHERE u.role = 'user'
              AND COALESCE(u.account_status, 'active') != 'deleted'
              AND COALESCE(u.is_premium, false) = true
              AND u.premium_expire_date IS NOT NULL
              AND u.premium_expire_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
            ORDER BY u.premium_expire_date ASC
            LIMIT 100
        `),

        db.query(`
            SELECT
                ${planCase} AS plan_bucket,
                COUNT(*)::int AS orders,
                COUNT(DISTINCT p.user_id)::int AS buyers,
                COALESCE(SUM(p.amount), 0)::numeric(12,2) AS revenue
            FROM payments p
            WHERE p.status = 'completed_vip'
              ${excludeClause}
            GROUP BY 1
            ORDER BY revenue DESC
        `)
    ]);

    const breakdown = { '1_month': 0, '3_months': 0, '6_months': 0, unspecified: 0 };
    let totalActive = 0;
    for (const r of activeRes.rows) {
        totalActive += r.count || 0;
        if (breakdown.hasOwnProperty(r.plan_bucket)) {
            breakdown[r.plan_bucket] += r.count || 0;
        } else {
            breakdown.unspecified += r.count || 0;
        }
    }

    let lifecycle = {
        hasEventsTable: schema.hasSubscriptionEvents,
        hasEventData: false,
        thisMonthRenewals: null,
        prevMonthRenewals: null,
        renewalDeltaPct: null,
        thisMonthCancellations: null,
        prevMonthCancellations: null,
        cancellationDeltaPct: null,
        thisMonthExpirations: null,
        thisMonthBillingIssues: null,
        recentEvents: []
    };

    if (schema.hasSubscriptionEvents) {
        const subFilter = excludeTest ? `AND COALESCE(UPPER(environment), 'PRODUCTION') != 'SANDBOX'` : '';
        const [aggRes, recentRes] = await Promise.all([
            db.query(`
                WITH bounds AS (
                    SELECT
                        (date_trunc('month', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS m_start,
                        ((date_trunc('month', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '1 month') AT TIME ZONE '${TR_TZ}') AS pm_start
                )
                SELECT
                    COUNT(*)::int AS total_events,
                    COUNT(*) FILTER (WHERE event_type = 'RENEWAL' AND created_at >= b.m_start)::int AS m_renewals,
                    COUNT(*) FILTER (WHERE event_type = 'RENEWAL' AND created_at >= b.pm_start AND created_at < b.m_start)::int AS pm_renewals,
                    COUNT(*) FILTER (WHERE event_type = 'CANCELLATION' AND created_at >= b.m_start)::int AS m_cancels,
                    COUNT(*) FILTER (WHERE event_type = 'CANCELLATION' AND created_at >= b.pm_start AND created_at < b.m_start)::int AS pm_cancels,
                    COUNT(*) FILTER (WHERE event_type = 'EXPIRATION' AND created_at >= b.m_start)::int AS m_expirations,
                    COUNT(*) FILTER (WHERE event_type = 'BILLING_ISSUE' AND created_at >= b.m_start)::int AS m_billing_issues
                FROM subscription_events CROSS JOIN bounds b
                WHERE 1=1 ${subFilter}
            `),
            db.query(`
                SELECT se.id, se.event_type, se.product_id, se.duration_months, se.price, se.currency, se.environment, se.cancel_reason, se.expiration_at, se.created_at,
                       se.user_id, u.username
                FROM subscription_events se
                LEFT JOIN users u ON se.user_id::text = u.id::text
                WHERE 1=1 ${subFilter}
                ORDER BY se.created_at DESC
                LIMIT 30
            `)
        ]);
        const a = aggRes.rows[0] || {};
        if ((a.total_events || 0) > 0) {
            lifecycle = {
                hasEventsTable: true,
                hasEventData: true,
                thisMonthRenewals: a.m_renewals || 0,
                prevMonthRenewals: a.pm_renewals || 0,
                renewalDeltaPct: pctDelta(a.m_renewals || 0, a.pm_renewals || 0),
                thisMonthCancellations: a.m_cancels || 0,
                prevMonthCancellations: a.pm_cancels || 0,
                cancellationDeltaPct: pctDelta(a.m_cancels || 0, a.pm_cancels || 0),
                thisMonthExpirations: a.m_expirations || 0,
                thisMonthBillingIssues: a.m_billing_issues || 0,
                recentEvents: recentRes.rows
            };
        }
    }

    const planLabels = {
        '1_month': '1 Aylık Premium',
        '3_months': '3 Aylık Premium',
        '6_months': '6 Aylık Premium',
        other: 'Diğer / Eski Fiyat'
    };

    return {
        excludeTest,
        activeSummary: {
            total: totalActive,
            oneMonth: breakdown['1_month'],
            threeMonths: breakdown['3_months'],
            sixMonths: breakdown['6_months'],
            unspecified: breakdown.unspecified,
        },
        lifecycle,
        expiringSoon: expiringRes.rows.map((r) => ({
            ...r,
            last_payment_amount: r.last_payment_amount != null ? parseFloat(r.last_payment_amount) : null,
            daysLeft: Math.max(0, Math.ceil((new Date(r.premium_expire_date).getTime() - Date.now()) / 86400000))
        })),
        revenueByProduct: revenueRes.rows.map((r) => ({
            planKey: r.plan_bucket,
            label: planLabels[r.plan_bucket] || r.plan_bucket,
            orders: r.orders || 0,
            buyers: r.buyers || 0,
            revenue: toNet(r.revenue || 0),
            grossRevenue: parseFloat(r.revenue || 0)
        }))
    };
}

/**
 * 5) KARŞILAŞTIRMA VE AYLIK HEDEF
 */
async function getTargetsAndComparison(db, requestedMonth = null) {
    const schema = await getSchemaAvailability(db);
    const nowTrRes = await db.query(`
        SELECT
            TO_CHAR(NOW() AT TIME ZONE '${TR_TZ}', 'YYYY-MM') AS current_month,
            EXTRACT(DAY FROM NOW() AT TIME ZONE '${TR_TZ}')::int AS elapsed_days,
            EXTRACT(DAY FROM (date_trunc('month', NOW() AT TIME ZONE '${TR_TZ}') + INTERVAL '1 month - 1 day'))::int AS days_in_month
    `);
    const curTr = nowTrRes.rows[0];
    const monthKey = /^\d{4}-\d{2}$/.test(requestedMonth || '') ? requestedMonth : curTr.current_month;

    let targetRow = { revenue_target: 0, registrations_target: 0, updated_at: null };
    if (schema.hasMonthlyTargets) {
        const tRes = await db.query('SELECT revenue_target, registrations_target, updated_at FROM monthly_targets WHERE month_key = $1', [monthKey]);
        if (tRes.rows.length > 0) {
            targetRow = {
                revenue_target: parseFloat(tRes.rows[0].revenue_target || 0),
                registrations_target: parseInt(tRes.rows[0].registrations_target || 0, 10),
                updated_at: tRes.rows[0].updated_at
            };
        }
    }

    const [cmpRes, monthProgressRes] = await Promise.all([
        db.query(`
            WITH bounds AS (
                SELECT
                    (date_trunc('week', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS w_start,
                    ((date_trunc('week', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '7 days') AT TIME ZONE '${TR_TZ}') AS pw_start,
                    (date_trunc('month', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS m_start,
                    ((date_trunc('month', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '1 month') AT TIME ZONE '${TR_TZ}') AS pm_start,
                    (NOW() - INTERVAL '7 days') AS l7_start,
                    (NOW() - INTERVAL '14 days') AS pl7_start
            ),
            pay AS (
                SELECT
                    COALESCE(SUM(amount) FILTER (WHERE created_at >= b.w_start), 0)::numeric(12,2) AS w_rev,
                    COALESCE(SUM(amount) FILTER (WHERE created_at >= b.pw_start AND created_at < b.w_start), 0)::numeric(12,2) AS pw_rev,
                    COUNT(DISTINCT user_id) FILTER (WHERE created_at >= b.w_start)::int AS w_payers,
                    COUNT(DISTINCT user_id) FILTER (WHERE created_at >= b.pw_start AND created_at < b.w_start)::int AS pw_payers,
                    COALESCE(SUM(amount) FILTER (WHERE created_at >= b.m_start), 0)::numeric(12,2) AS m_rev,
                    COALESCE(SUM(amount) FILTER (WHERE created_at >= b.pm_start AND created_at < b.m_start), 0)::numeric(12,2) AS pm_rev,
                    COUNT(DISTINCT user_id) FILTER (WHERE created_at >= b.m_start)::int AS m_payers,
                    COUNT(DISTINCT user_id) FILTER (WHERE created_at >= b.pm_start AND created_at < b.m_start)::int AS pm_payers,
                    COALESCE(SUM(amount) FILTER (WHERE created_at >= b.l7_start), 0)::numeric(12,2) AS l7_rev,
                    COALESCE(SUM(amount) FILTER (WHERE created_at >= b.pl7_start AND created_at < b.l7_start), 0)::numeric(12,2) AS pl7_rev
                FROM payments CROSS JOIN bounds b
                WHERE COALESCE(status, 'completed') IN ('completed', 'completed_vip')
            ),
            usr AS (
                SELECT
                    COUNT(*) FILTER (WHERE created_at >= b.w_start)::int AS w_reg,
                    COUNT(*) FILTER (WHERE created_at >= b.pw_start AND created_at < b.w_start)::int AS pw_reg,
                    COUNT(*) FILTER (WHERE created_at >= b.m_start)::int AS m_reg,
                    COUNT(*) FILTER (WHERE created_at >= b.pm_start AND created_at < b.m_start)::int AS pm_reg,
                    COUNT(*) FILTER (WHERE created_at >= b.l7_start)::int AS l7_reg,
                    COUNT(*) FILTER (WHERE created_at >= b.pl7_start AND created_at < b.l7_start)::int AS pl7_reg
                FROM users CROSS JOIN bounds b
                WHERE role = 'user' AND COALESCE(account_status, 'active') != 'deleted'
            )
            SELECT * FROM pay, usr
        `),

        db.query(`
            WITH bounds AS (
                SELECT
                    (($1 || '-01')::timestamp AT TIME ZONE '${TR_TZ}') AS m_start,
                    ((($1 || '-01')::date + INTERVAL '1 month')::timestamp AT TIME ZONE '${TR_TZ}') AS m_end
            )
            SELECT
                (SELECT COALESCE(SUM(amount), 0)::numeric(12,2) FROM payments p CROSS JOIN bounds b
                 WHERE COALESCE(p.status, 'completed') IN ('completed', 'completed_vip')
                   AND p.created_at >= b.m_start AND p.created_at < b.m_end) AS month_revenue,
                (SELECT COUNT(*)::int FROM users u CROSS JOIN bounds b
                 WHERE u.role = 'user' AND COALESCE(u.account_status, 'active') != 'deleted'
                   AND u.created_at >= b.m_start AND u.created_at < b.m_end) AS month_registrations
        `, [monthKey])
    ]);

    const c = cmpRes.rows[0] || {};
    const mp = monthProgressRes.rows[0] || {};
    const actualRev = toNet(mp.month_revenue || 0);
    const actualReg = parseInt(mp.month_registrations || 0, 10);

    const isCurrentMonth = monthKey === curTr.current_month;
    const elapsedDays = isCurrentMonth ? Math.max(1, curTr.elapsed_days) : curTr.days_in_month;
    const forecastRev = Number(((actualRev / elapsedDays) * curTr.days_in_month).toFixed(2));
    const forecastReg = Math.round((actualReg / elapsedDays) * curTr.days_in_month);

    const wConv = (c.w_reg || 0) > 0 ? Number(((c.w_payers / c.w_reg) * 100).toFixed(1)) : 0;
    const pwConv = (c.pw_reg || 0) > 0 ? Number(((c.pw_payers / c.pw_reg) * 100).toFixed(1)) : 0;
    const mConv = (c.m_reg || 0) > 0 ? Number(((c.m_payers / c.m_reg) * 100).toFixed(1)) : 0;
    const pmConv = (c.pm_reg || 0) > 0 ? Number(((c.pm_payers / c.pm_reg) * 100).toFixed(1)) : 0;

    return {
        hasTargetsTable: schema.hasMonthlyTargets,
        monthKey,
        elapsedDays,
        daysInMonth: curTr.days_in_month,
        comparisons: {
            weekVsPrevWeek: {
                revenue: { current: toNet(c.w_rev || 0), previous: toNet(c.pw_rev || 0), deltaPct: pctDelta(c.w_rev, c.pw_rev) },
                registrations: { current: c.w_reg || 0, previous: c.pw_reg || 0, deltaPct: pctDelta(c.w_reg, c.pw_reg), lowSample: (c.w_reg || 0) < 30 },
                payingUsers: { current: c.w_payers || 0, previous: c.pw_payers || 0, deltaPct: pctDelta(c.w_payers, c.pw_payers) },
                conversionPct: { current: wConv, previous: pwConv, deltaPct: pctDelta(wConv, pwConv), lowSample: (c.w_reg || 0) < 30 }
            },
            monthVsPrevMonth: {
                revenue: { current: toNet(c.m_rev || 0), previous: toNet(c.pm_rev || 0), deltaPct: pctDelta(c.m_rev, c.pm_rev) },
                registrations: { current: c.m_reg || 0, previous: c.pm_reg || 0, deltaPct: pctDelta(c.m_reg, c.pm_reg), lowSample: (c.m_reg || 0) < 30 },
                payingUsers: { current: c.m_payers || 0, previous: c.pm_payers || 0, deltaPct: pctDelta(c.m_payers, c.pm_payers) },
                conversionPct: { current: mConv, previous: pmConv, deltaPct: pctDelta(mConv, pmConv), lowSample: (c.m_reg || 0) < 30 }
            },
            last7VsPrev7: {
                revenue: { current: toNet(c.l7_rev || 0), previous: toNet(c.pl7_rev || 0), deltaPct: pctDelta(c.l7_rev, c.pl7_rev) },
                registrations: { current: c.l7_reg || 0, previous: c.pl7_reg || 0, deltaPct: pctDelta(c.l7_reg, c.pl7_reg), lowSample: (c.l7_reg || 0) < 30 }
            }
        },
        target: {
            revenueTarget: targetRow.revenue_target,
            registrationsTarget: targetRow.registrations_target,
            actualRevenue: actualRev,
            actualRegistrations: actualReg,
            revenueProgressPct: targetRow.revenue_target > 0 ? Number(Math.min(999, (actualRev / targetRow.revenue_target) * 100).toFixed(1)) : null,
            registrationsProgressPct: targetRow.registrations_target > 0 ? Number(Math.min(999, (actualReg / targetRow.registrations_target) * 100).toFixed(1)) : null,
            forecastRevenue: forecastRev,
            forecastRegistrations: forecastReg,
            lowSample: actualReg < 30,
            updatedAt: targetRow.updated_at
        }
    };
}

/**
 * 6) SALT-OKUNUR KULLANICI DETAY SAYFASI
 */
async function getReadOnlyUserDetail(db, userId) {
    const schema = await getSchemaAvailability(db);
    const acqSelect = schema.hasAcquisitionCols
        ? `COALESCE(NULLIF(TRIM(u.acquisition_source), ''), CASE WHEN u.referred_by IS NOT NULL THEN 'referans' ELSE 'bilinmiyor' END) AS acquisition_source, u.utm_source, u.utm_medium, u.utm_campaign,`
        : `CASE WHEN u.referred_by IS NOT NULL THEN 'referans' ELSE 'bilinmiyor' END AS acquisition_source, NULL::text AS utm_source, NULL::text AS utm_medium, NULL::text AS utm_campaign,`;
    const verSelect = schema.hasAppVersionCol ? `u.app_version,` : `NULL::text AS app_version,`;

    const userRes = await db.query(`
        SELECT
            u.id, u.username, COALESCE(u.display_name, u.name, u.username) AS display_name,
            u.email, u.phone, u.avatar_url, u.gender, u.age, u.city, u.country, u.role,
            COALESCE(u.balance, 0) AS balance,
            COALESCE(u.is_vip, false) AS is_vip,
            COALESCE(u.vip_level, 0) AS vip_level,
            COALESCE(u.is_premium, false) AS is_premium,
            u.premium_start_date,
            u.premium_expire_date,
            u.vip_expire_date,
            COALESCE(u.account_status, 'active') AS account_status,
            u.referred_by,
            u.created_at,
            u.last_login_at,
            ${acqSelect}
            ${verSelect}
            COALESCE((
                SELECT SUM(p.amount) FROM payments p
                WHERE p.user_id::text = u.id::text AND COALESCE(p.status, 'completed') IN ('completed', 'completed_vip')
            ), 0)::numeric(12,2) AS total_spent_verified
        FROM users u
        WHERE u.id::text = $1::text
        LIMIT 1
    `, [String(userId)]);

    if (userRes.rows.length === 0) return null;
    const raw = userRes.rows[0];

    const [paymentsRes, txRes, msgCountsRes, reportsRes] = await Promise.all([
        db.query(`
            SELECT p.id, p.transaction_id, p.amount, p.coin_amount, p.status, p.payment_method, p.created_at,
                   COALESCE(p.package_name_snapshot, cp.name, CONCAT(COALESCE(p.coin_amount, cp.coins, 0), ' Coin')) AS product_name
            FROM payments p
            LEFT JOIN coin_packages cp ON p.package_id = cp.id
            WHERE p.user_id::text = $1::text
            ORDER BY p.created_at DESC
            LIMIT 100
        `, [String(userId)]),

        db.query(`
            SELECT id, amount, type, description, created_at
            FROM transactions
            WHERE user_id::text = $1::text
            ORDER BY created_at DESC
            LIMIT 120
        `, [String(userId)]),

        db.query(`
            SELECT
                COUNT(*) FILTER (WHERE m.sender_id::text = $1::text)::int AS sent_count,
                COUNT(*) FILTER (WHERE m.sender_id::text != $1::text)::int AS received_count,
                COUNT(*)::int AS total_count,
                MAX(m.created_at) AS last_message_at
            FROM messages m
            JOIN chats c ON m.chat_id = c.id
            WHERE c.user_id::text = $1::text OR m.sender_id::text = $1::text
        `, [String(userId)]),

        db.query(`
            SELECT
                r.id, r.reason, COALESCE(r.details, r.description) AS details, COALESCE(r.status, 'pending') AS status, r.created_at,
                CASE
                    WHEN r.reporter_id::text = $1::text OR r.reporter_user_id::text = $1::text THEN 'filed_by_user'
                    ELSE 'against_user'
                END AS direction,
                COALESCE(ru.username, '-') AS reporter_username,
                COALESCE(tu.username, '-') AS reported_username
            FROM reports r
            LEFT JOIN users ru ON COALESCE(r.reporter_id, r.reporter_user_id)::text = ru.id::text
            LEFT JOIN users tu ON COALESCE(r.reported_id, r.target_user_id)::text = tu.id::text
            WHERE r.reporter_id::text = $1::text
               OR r.reporter_user_id::text = $1::text
               OR r.reported_id::text = $1::text
               OR r.target_user_id::text = $1::text
            ORDER BY r.created_at DESC
            LIMIT 50
        `, [String(userId)])
    ]);

    const reportsAll = reportsRes.rows;
    const openStatuses = new Set(['pending', 'open', 'in_review']);

    return {
        readOnly: true,
        profile: {
            ...raw,
            balance: parseInt(raw.balance || 0, 10),
            total_spent_verified: parseFloat(raw.total_spent_verified || 0),
            is_premium_active: Boolean(raw.is_premium && (!raw.premium_expire_date || new Date(raw.premium_expire_date) > new Date())),
        },
        payments: paymentsRes.rows.map((p) => ({
            ...p,
            amount: parseFloat(p.amount || 0),
            coin_amount: parseInt(p.coin_amount || 0, 10)
        })),
        transactions: txRes.rows,
        messageStats: msgCountsRes.rows[0] || { sent_count: 0, received_count: 0, total_count: 0, last_message_at: null },
        reports: {
            filedByUser: reportsAll.filter((r) => r.direction === 'filed_by_user'),
            againstUser: reportsAll.filter((r) => r.direction === 'against_user'),
            openCount: reportsAll.filter((r) => openStatuses.has(String(r.status).toLowerCase())).length,
            closedCount: reportsAll.filter((r) => !openStatuses.has(String(r.status).toLowerCase())).length,
        },
        dataAvailability: {
            hasAcquisitionCols: schema.hasAcquisitionCols,
            hasAppVersionCol: schema.hasAppVersionCol,
            missingNotes: [
                ...(!schema.hasAcquisitionCols ? ['Kayıt kaynağı alanları (users.acquisition_source, utm_*) henüz migration ile eklenmemiş.'] : []),
                ...(!schema.hasAppVersionCol ? ['Uygulama sürümü (users.app_version / user_sessions.app_version) alanı henüz eklenmemiş.'] : [])
            ]
        }
    };
}

module.exports = {
    getSchemaAvailability,
    getRetentionOverview,
    getAcquisitionOverview,
    getSubscriptionsOverview,
    getTargetsAndComparison,
    getReadOnlyUserDetail,
};
