const db = require('../db');
const { sanitizeUser } = require('../utils/helpers');
const { getActiveCustomerIds } = require('../utils/autoMessageSystem');
const { isUserPremiumActive } = require('../utils/vipUtils');

const TR_TZ = 'Europe/Istanbul';

function calcDeltaPct(current, previous) {
    const cur = Number(current) || 0;
    const prev = Number(previous) || 0;
    if (prev <= 0) return cur > 0 ? 100 : 0;
    return Number((((cur - prev) / prev) * 100).toFixed(1));
}

function parseDateRange(startStr, endStr) {
    const todayTr = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
    const clean = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim()) ? String(s).trim() : null);
    const start = clean(startStr) || todayTr;
    const end = clean(endStr) || start;
    return start <= end ? { start, end } : { start: end, end: start };
}

/**
 * Computes full executive overview metrics for the redesigned Admin Dashboard.
 */
async function getDashboardOverviewStats(req) {
    const activeIds = getActiveCustomerIds();

    const [
        revSummaryRes,
        userSummaryRes,
        revByPkgRes,
        revByMethodRes,
        topCitiesRes,
        genderRes,
        funnelRes,
        speedRes,
        peakHoursRegRes,
        peakHoursPayRes,
        recentPaymentsRes,
        hotZeroCoinRes,
        loyalBuyersRes,
        expiringPremiumRes,
        signalCountsRes,
        newUsersPeriodsRes,
        newUsersTodayListRes,
        newUsersYesterdayListRes,
        newUsersWeekListRes,
        newUsersMonthListRes,
        dailyReportRes
    ] = await Promise.all([
        // 1. Real payments revenue & conversion summary (Europe/Istanbul day boundaries)
        db.query(`
            WITH bounds AS (
                SELECT
                    (date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS today_start,
                    ((date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '1 day') AT TIME ZONE '${TR_TZ}') AS yesterday_start,
                    (date_trunc('week', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS week_start,
                    ((date_trunc('week', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '7 days') AT TIME ZONE '${TR_TZ}') AS prev_week_start,
                    (date_trunc('month', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS month_start,
                    ((date_trunc('month', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '1 month') AT TIME ZONE '${TR_TZ}') AS prev_month_start
            ),
            completed AS (
                SELECT p.*, b.today_start, b.yesterday_start, b.week_start, b.prev_week_start, b.month_start, b.prev_month_start
                FROM payments p CROSS JOIN bounds b
                WHERE COALESCE(p.status, 'completed') = 'completed'
            ),
            buyer_counts AS (
                SELECT user_id, COUNT(*)::int AS orders, COALESCE(SUM(amount), 0) AS spent
                FROM completed
                GROUP BY user_id
            )
            SELECT
                COALESCE((SELECT SUM(amount) FROM completed), 0)::numeric(12,2) AS total_revenue,
                COALESCE((SELECT SUM(amount) FROM completed WHERE created_at >= today_start), 0)::numeric(12,2) AS today_revenue,
                COALESCE((SELECT SUM(amount) FROM completed WHERE created_at >= yesterday_start AND created_at < today_start), 0)::numeric(12,2) AS yesterday_revenue,
                COALESCE((SELECT SUM(amount) FROM completed WHERE created_at >= week_start), 0)::numeric(12,2) AS week_revenue,
                COALESCE((SELECT SUM(amount) FROM completed WHERE created_at >= prev_week_start AND created_at < week_start), 0)::numeric(12,2) AS prev_week_revenue,
                COALESCE((SELECT SUM(amount) FROM completed WHERE created_at >= month_start), 0)::numeric(12,2) AS month_revenue,
                COALESCE((SELECT SUM(amount) FROM completed WHERE created_at >= prev_month_start AND created_at < month_start), 0)::numeric(12,2) AS prev_month_revenue,
                (SELECT COUNT(*)::int FROM completed) AS total_orders,
                (SELECT COUNT(*)::int FROM completed WHERE created_at >= today_start) AS today_orders,
                (SELECT COUNT(*)::int FROM completed WHERE created_at >= yesterday_start AND created_at < today_start) AS yesterday_orders,
                (SELECT COUNT(*)::int FROM buyer_counts) AS paying_users,
                (SELECT COUNT(*)::int FROM buyer_counts WHERE orders >= 2) AS repeat_buyers
        `),

        // 2. Customer counts & growth across periods
        db.query(`
            WITH bounds AS (
                SELECT
                    (date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS today_start,
                    ((date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '1 day') AT TIME ZONE '${TR_TZ}') AS yesterday_start,
                    (date_trunc('week', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS week_start,
                    ((date_trunc('week', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '7 days') AT TIME ZONE '${TR_TZ}') AS prev_week_start,
                    (date_trunc('month', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS month_start,
                    ((date_trunc('month', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '1 month') AT TIME ZONE '${TR_TZ}') AS prev_month_start
            )
            SELECT
                COUNT(*)::int AS total_users,
                COUNT(*) FILTER (WHERE u.created_at >= b.today_start)::int AS today_users,
                COUNT(*) FILTER (WHERE u.created_at >= b.yesterday_start AND u.created_at < b.today_start)::int AS yesterday_users,
                COUNT(*) FILTER (WHERE u.created_at >= b.week_start)::int AS week_users,
                COUNT(*) FILTER (WHERE u.created_at >= b.prev_week_start AND u.created_at < b.week_start)::int AS prev_week_users,
                COUNT(*) FILTER (WHERE u.created_at >= b.month_start)::int AS month_users,
                COUNT(*) FILTER (WHERE u.created_at >= b.prev_month_start AND u.created_at < b.month_start)::int AS prev_month_users,
                COUNT(*) FILTER (WHERE u.balance <= 0)::int AS zero_coin_users,
                COUNT(*) FILTER (WHERE u.is_premium = true OR (COALESCE(u.premium_expire_date, u.vip_expire_date) > NOW()))::int AS active_premium_users
            FROM users u CROSS JOIN bounds b
            WHERE u.role = 'user' AND COALESCE(u.account_status, 'active') != 'deleted'
        `),

        // 3. Package breakdown
        db.query(`
            SELECT
                COALESCE(NULLIF(TRIM(p.package_name_snapshot), ''), cp.name, 'Diğer Paket') AS name,
                COUNT(*)::int AS orders,
                COALESCE(SUM(p.amount), 0)::numeric(12,2) AS revenue,
                COALESCE(SUM(p.coin_amount), 0)::int AS coins
            FROM payments p
            LEFT JOIN coin_packages cp ON p.package_id = cp.id
            WHERE COALESCE(p.status, 'completed') = 'completed'
            GROUP BY 1
            ORDER BY revenue DESC
            LIMIT 10
        `),

        // 4. Payment method breakdown
        db.query(`
            SELECT
                COALESCE(NULLIF(TRIM(payment_method), ''), 'belirsiz') AS method,
                COUNT(*)::int AS orders,
                COALESCE(SUM(amount), 0)::numeric(12,2) AS revenue
            FROM payments
            WHERE COALESCE(status, 'completed') = 'completed'
            GROUP BY 1
            ORDER BY revenue DESC
        `),

        // 5. Top 6 cities
        db.query(`
            SELECT COALESCE(NULLIF(TRIM(city), ''), 'Belirtilmedi') AS city, COUNT(*)::int AS count
            FROM users
            WHERE role = 'user' AND COALESCE(account_status, 'active') != 'deleted'
            GROUP BY 1
            ORDER BY count DESC
            LIMIT 6
        `),

        // 6. Gender split
        db.query(`
            SELECT
                COUNT(*) FILTER (WHERE LOWER(COALESCE(gender, '')) IN ('erkek', 'male'))::int AS male,
                COUNT(*) FILTER (WHERE LOWER(COALESCE(gender, '')) IN ('kadin', 'kadın', 'female'))::int AS female,
                COUNT(*) FILTER (WHERE LOWER(COALESCE(gender, '')) NOT IN ('erkek', 'male', 'kadin', 'kadın', 'female'))::int AS other
            FROM users
            WHERE role = 'user' AND COALESCE(account_status, 'active') != 'deleted'
        `),

        // 7. Conversion funnel (All time & Last 7 days)
        db.query(`
            WITH cust AS (
                SELECT u.id, u.onboarding_completed, u.balance, u.created_at,
                       EXISTS (SELECT 1 FROM messages m WHERE m.sender_id = u.id) AS has_messaged,
                       EXISTS (SELECT 1 FROM activities a WHERE a.user_id = u.id AND a.action_type = 'free_messages_exhausted') AS has_exhausted_event,
                       COALESCE((SELECT COUNT(*) FROM payments p WHERE p.user_id::text = u.id::text AND COALESCE(p.status, 'completed') = 'completed'), 0)::int AS pay_count
                FROM users u
                WHERE u.role = 'user' AND COALESCE(u.account_status, 'active') != 'deleted'
            )
            SELECT
                COUNT(*)::int AS all_registered,
                COUNT(*) FILTER (WHERE onboarding_completed = true)::int AS all_onboarded,
                COUNT(*) FILTER (WHERE has_messaged)::int AS all_messaged,
                COUNT(*) FILTER (WHERE has_exhausted_event OR balance <= 0 OR pay_count > 0)::int AS all_exhausted,
                COUNT(*) FILTER (WHERE pay_count >= 1)::int AS all_paid,
                COUNT(*) FILTER (WHERE pay_count >= 2)::int AS all_repeat,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS w7_registered,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days' AND onboarding_completed = true)::int AS w7_onboarded,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days' AND has_messaged)::int AS w7_messaged,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days' AND (has_exhausted_event OR balance <= 0 OR pay_count > 0))::int AS w7_exhausted,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days' AND pay_count >= 1)::int AS w7_paid,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days' AND pay_count >= 2)::int AS w7_repeat
            FROM cust
        `),

        // 8. Ek Öneri 1: First-30-min ad quality conversion speed
        db.query(`
            WITH first_pay AS (
                SELECT u.id, u.created_at AS reg_at, MIN(p.created_at) AS first_pay_at
                FROM users u
                LEFT JOIN payments p
                    ON p.user_id::text = u.id::text
                   AND COALESCE(p.status, 'completed') = 'completed'
                WHERE u.role = 'user'
                  AND COALESCE(u.account_status, 'active') != 'deleted'
                  AND u.created_at >= NOW() - INTERVAL '7 days'
                GROUP BY u.id, u.created_at
            )
            SELECT
                COUNT(*)::int AS total_7d,
                COUNT(*) FILTER (WHERE first_pay_at IS NOT NULL)::int AS paid_7d,
                COUNT(*) FILTER (WHERE first_pay_at IS NOT NULL AND first_pay_at <= reg_at + INTERVAL '30 minutes')::int AS paid_within_30m_7d,
                COUNT(*) FILTER (WHERE reg_at >= (date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}'))::int AS total_today,
                COUNT(*) FILTER (WHERE reg_at >= (date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AND first_pay_at IS NOT NULL AND first_pay_at <= reg_at + INTERVAL '30 minutes')::int AS paid_within_30m_today,
                COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (first_pay_at - reg_at)) / 60.0) FILTER (WHERE first_pay_at IS NOT NULL AND first_pay_at >= reg_at)), 0)::int AS avg_minutes_to_pay
            FROM first_pay
        `),

        // 9. Ek Öneri 3: 24-hour Peak Hours (Registrations, 7 days, TR time)
        db.query(`
            SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE '${TR_TZ}'))::int AS hour, COUNT(*)::int AS count
            FROM users
            WHERE role = 'user' AND created_at >= NOW() - INTERVAL '7 days'
            GROUP BY 1
            ORDER BY 1 ASC
        `),

        // 10. Ek Öneri 3: 24-hour Peak Hours (Payments, 7 days, TR time)
        db.query(`
            SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE '${TR_TZ}'))::int AS hour,
                   COUNT(*)::int AS count,
                   COALESCE(SUM(amount), 0)::numeric(12,2) AS revenue
            FROM payments
            WHERE COALESCE(status, 'completed') = 'completed' AND created_at >= NOW() - INTERVAL '7 days'
            GROUP BY 1
            ORDER BY 1 ASC
        `),

        // 11. Live payments stream (last 15)
        db.query(`
            SELECT p.id, p.user_id, p.amount, p.coin_amount, p.payment_method, p.created_at,
                   COALESCE(NULLIF(TRIM(p.package_name_snapshot), ''), cp.name, 'Paket') AS package_name,
                   COALESCE(u.display_name, u.username, 'Kullanıcı') AS user_name,
                   u.email AS user_email, u.avatar_url AS user_avatar
            FROM payments p
            LEFT JOIN users u ON p.user_id::text = u.id::text
            LEFT JOIN coin_packages cp ON p.package_id = cp.id
            WHERE COALESCE(p.status, 'completed') = 'completed'
            ORDER BY p.created_at DESC
            LIMIT 15
        `),

        // 12. Hot 0-coin active / recently active users
        db.query(`
            SELECT u.id, u.username, u.display_name, u.email, u.avatar_url, u.balance, u.city, u.age,
                   u.last_login_at, u.created_at,
                   COALESCE((SELECT COUNT(*) FROM payments p WHERE p.user_id::text = u.id::text AND COALESCE(p.status, 'completed') = 'completed'), 0)::int AS pay_count,
                   (SELECT c.id FROM chats c WHERE c.user_id = u.id ORDER BY c.last_message_at DESC NULLS LAST LIMIT 1) AS last_chat_id
            FROM users u
            WHERE u.role = 'user'
              AND COALESCE(u.account_status, 'active') = 'active'
              AND u.balance <= 10
              AND (u.id::text = ANY($1::text[]) OR COALESCE(u.last_login_at, u.created_at) >= NOW() - INTERVAL '12 hours')
            ORDER BY (u.id::text = ANY($1::text[])) DESC, COALESCE(u.last_login_at, u.created_at) DESC
            LIMIT 15
        `, [activeIds]),

        // 13. Ek Öneri 2: Top loyal / repeat buyers
        db.query(`
            SELECT u.id, u.username, u.display_name, u.email, u.avatar_url, u.balance, u.vip_level,
                   u.is_premium, u.premium_expire_date, u.vip_expire_date,
                   COUNT(p.id)::int AS orders,
                   COALESCE(SUM(p.amount), 0)::numeric(12,2) AS total_tl,
                   COALESCE(SUM(p.coin_amount), 0)::int AS total_coins,
                   MAX(p.created_at) AS last_purchase_at
            FROM payments p
            JOIN users u ON p.user_id::text = u.id::text
            WHERE COALESCE(p.status, 'completed') = 'completed' AND u.role = 'user'
            GROUP BY u.id
            ORDER BY total_tl DESC, orders DESC
            LIMIT 10
        `),

        // 14. Ek Öneri 2: Expiring Premium subscriptions (within 7 days)
        db.query(`
            SELECT id, username, display_name, email, avatar_url, balance, vip_level,
                   COALESCE(premium_expire_date, vip_expire_date) AS expires_at
            FROM users
            WHERE role = 'user'
              AND COALESCE(account_status, 'active') = 'active'
              AND COALESCE(premium_expire_date, vip_expire_date) BETWEEN NOW() AND NOW() + INTERVAL '7 days'
            ORDER BY expires_at ASC
            LIMIT 10
        `),

        // 15. Funnel & uninstall signals (24h & total)
        db.query(`
            SELECT
                (SELECT COUNT(DISTINCT user_id)::int FROM activities WHERE action_type = 'free_messages_exhausted' AND created_at >= NOW() - INTERVAL '24 hours') AS exhausted_24h,
                (SELECT COUNT(DISTINCT user_id)::int FROM activities WHERE action_type = 'push_unregistered' AND created_at >= NOW() - INTERVAL '24 hours') AS push_unreg_24h,
                (SELECT COUNT(*)::int FROM users WHERE role = 'user' AND COALESCE(ai_hook_sent, false) = true) AS ai_hooks_total,
                (SELECT COUNT(*)::int FROM users u WHERE u.role = 'user' AND COALESCE(u.ai_hook_sent, false) = true AND EXISTS (SELECT 1 FROM payments p WHERE p.user_id::text = u.id::text AND COALESCE(p.status, 'completed') = 'completed')) AS ai_hooks_paid
        `),

        // 16. New users periods summary + conversion % per period
        db.query(`
            WITH bounds AS (
                SELECT
                    (date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS today_start,
                    ((date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '1 day') AT TIME ZONE '${TR_TZ}') AS yesterday_start,
                    ((date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '2 days') AT TIME ZONE '${TR_TZ}') AS day_before_start,
                    (date_trunc('week', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS week_start,
                    ((date_trunc('week', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '7 days') AT TIME ZONE '${TR_TZ}') AS prev_week_start,
                    (date_trunc('month', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}') AS month_start,
                    ((date_trunc('month', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '1 month') AT TIME ZONE '${TR_TZ}') AS prev_month_start
            ),
            u_pay AS (
                SELECT u.id, u.created_at,
                       COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.user_id::text = u.id::text AND COALESCE(p.status, 'completed') = 'completed'), 0)::numeric(12,2) AS paid_tl
                FROM users u
                WHERE u.role = 'user' AND COALESCE(u.account_status, 'active') != 'deleted'
            )
            SELECT
                COUNT(*) FILTER (WHERE u.created_at >= b.today_start)::int AS today_count,
                COUNT(*) FILTER (WHERE u.created_at >= b.today_start AND u.paid_tl > 0)::int AS today_paying,
                COALESCE(SUM(u.paid_tl) FILTER (WHERE u.created_at >= b.today_start), 0)::numeric(12,2) AS today_rev,

                COUNT(*) FILTER (WHERE u.created_at >= b.yesterday_start AND u.created_at < b.today_start)::int AS yesterday_count,
                COUNT(*) FILTER (WHERE u.created_at >= b.yesterday_start AND u.created_at < b.today_start AND u.paid_tl > 0)::int AS yesterday_paying,
                COALESCE(SUM(u.paid_tl) FILTER (WHERE u.created_at >= b.yesterday_start AND u.created_at < b.today_start), 0)::numeric(12,2) AS yesterday_rev,
                COUNT(*) FILTER (WHERE u.created_at >= b.day_before_start AND u.created_at < b.yesterday_start)::int AS day_before_count,

                COUNT(*) FILTER (WHERE u.created_at >= b.week_start)::int AS week_count,
                COUNT(*) FILTER (WHERE u.created_at >= b.week_start AND u.paid_tl > 0)::int AS week_paying,
                COALESCE(SUM(u.paid_tl) FILTER (WHERE u.created_at >= b.week_start), 0)::numeric(12,2) AS week_rev,
                COUNT(*) FILTER (WHERE u.created_at >= b.prev_week_start AND u.created_at < b.week_start)::int AS prev_week_count,

                COUNT(*) FILTER (WHERE u.created_at >= b.month_start)::int AS month_count,
                COUNT(*) FILTER (WHERE u.created_at >= b.month_start AND u.paid_tl > 0)::int AS month_paying,
                COALESCE(SUM(u.paid_tl) FILTER (WHERE u.created_at >= b.month_start), 0)::numeric(12,2) AS month_rev,
                COUNT(*) FILTER (WHERE u.created_at >= b.prev_month_start AND u.created_at < b.month_start)::int AS prev_month_count
            FROM u_pay u CROSS JOIN bounds b
        `),

        fetchNewUsersPeriodList(`created_at >= (date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}')`, activeIds),
        fetchNewUsersPeriodList(`created_at >= ((date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '1 day') AT TIME ZONE '${TR_TZ}') AND created_at < (date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}')`, activeIds),
        fetchNewUsersPeriodList(`created_at >= (date_trunc('week', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}')`, activeIds),
        fetchNewUsersPeriodList(`created_at >= (date_trunc('month', NOW() AT TIME ZONE '${TR_TZ}') AT TIME ZONE '${TR_TZ}')`, activeIds),

        // 17. Daily cohort & revenue report (last 14 days, TR time)
        db.query(`
            WITH days AS (
                SELECT generate_series(
                    (date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}')::date - INTERVAL '13 days')::date,
                    (date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}')::date),
                    INTERVAL '1 day'
                )::date AS day
            ),
            u_cohort AS (
                SELECT
                    (u.created_at AT TIME ZONE '${TR_TZ}')::date AS reg_day,
                    COUNT(*)::int AS registered_count,
                    COUNT(*) FILTER (WHERE EXISTS (
                        SELECT 1 FROM payments p
                        WHERE p.user_id::text = u.id::text
                          AND COALESCE(p.status, 'completed') = 'completed'
                    ))::int AS cohort_paying_count,
                    COALESCE((
                        SELECT SUM(p.amount)
                        FROM payments p
                        WHERE p.user_id::text = u.id::text
                          AND COALESCE(p.status, 'completed') = 'completed'
                    ), 0) AS user_paid_total
                FROM users u
                WHERE u.role = 'user'
                  AND COALESCE(u.account_status, 'active') != 'deleted'
                  AND u.created_at >= ((date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '13 days') AT TIME ZONE '${TR_TZ}')
                GROUP BY 1, u.id
            ),
            u_day_agg AS (
                SELECT reg_day AS day,
                       COUNT(*)::int AS registered_count,
                       SUM(cohort_paying_count)::int AS cohort_paying_count,
                       COALESCE(SUM(user_paid_total), 0)::numeric(12,2) AS cohort_revenue
                FROM u_cohort
                GROUP BY reg_day
            ),
            p_day_agg AS (
                SELECT (p.created_at AT TIME ZONE '${TR_TZ}')::date AS day,
                       COUNT(DISTINCT p.user_id)::int AS day_buyers_count,
                       COUNT(*)::int AS day_orders_count,
                       COALESCE(SUM(p.amount), 0)::numeric(12,2) AS day_revenue
                FROM payments p
                WHERE COALESCE(p.status, 'completed') = 'completed'
                  AND p.created_at >= ((date_trunc('day', NOW() AT TIME ZONE '${TR_TZ}') - INTERVAL '13 days') AT TIME ZONE '${TR_TZ}')
                GROUP BY 1
            )
            SELECT
                TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
                COALESCE(ua.registered_count, 0)::int AS registered,
                COALESCE(ua.cohort_paying_count, 0)::int AS cohort_paying,
                COALESCE(ua.cohort_revenue, 0)::numeric(12,2) AS cohort_revenue,
                COALESCE(pa.day_buyers_count, 0)::int AS total_buyers,
                COALESCE(pa.day_orders_count, 0)::int AS total_orders,
                COALESCE(pa.day_revenue, 0)::numeric(12,2) AS total_revenue
            FROM days d
            LEFT JOIN u_day_agg ua ON ua.day = d.day
            LEFT JOIN p_day_agg pa ON pa.day = d.day
            ORDER BY d.day DESC
        `)
    ]);

    const rev = revSummaryRes.rows[0];
    const usr = userSummaryRes.rows[0];
    const f = funnelRes.rows[0];
    const sp = speedRes.rows[0];
    const sig = signalCountsRes.rows[0];
    const np = newUsersPeriodsRes.rows[0];

    const totalRevNum = parseFloat(rev.total_revenue || 0);
    const totalUsersNum = parseInt(usr.total_users || 0, 10);
    const payingUsersNum = parseInt(rev.paying_users || 0, 10);

    // Build 24-hour series (00..23)
    const regHourMap = new Map(peakHoursRegRes.rows.map((r) => [r.hour, r.count]));
    const payHourMap = new Map(peakHoursPayRes.rows.map((r) => [r.hour, { count: r.count, revenue: parseFloat(r.revenue || 0) }]));
    const peakHours = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        registrations: regHourMap.get(h) || 0,
        orders: payHourMap.get(h)?.count || 0,
        revenue: payHourMap.get(h)?.revenue || 0
    }));

    const sanitizeAvatars = (rows) => rows.map((row) => {
        const cleaned = sanitizeUser({ avatar_url: row.avatar_url || row.user_avatar }, req);
        const av = cleaned ? cleaned.avatar_url : (row.avatar_url || row.user_avatar);
        return row.user_avatar !== undefined
            ? { ...row, user_avatar: av }
            : { ...row, avatar_url: av };
    });

    const formatPeriodSummary = (count, prevCount, paying, revAmt) => ({
        count: parseInt(count || 0, 10),
        prevCount: parseInt(prevCount || 0, 10),
        deltaPct: calcDeltaPct(count, prevCount),
        payingCount: parseInt(paying || 0, 10),
        payingRatePct: count > 0 ? Number(((paying / count) * 100).toFixed(1)) : 0,
        revenue: Number(parseFloat(revAmt || 0).toFixed(2))
    });

    return {
        revenue: parseFloat(rev.total_revenue || 0).toFixed(2),
        activeUsers: totalUsersNum,
        revenueBreakdown: {
            total: Number(totalRevNum.toFixed(2)),
            today: Number(parseFloat(rev.today_revenue || 0).toFixed(2)),
            yesterday: Number(parseFloat(rev.yesterday_revenue || 0).toFixed(2)),
            todayDeltaPct: calcDeltaPct(rev.today_revenue, rev.yesterday_revenue),
            week: Number(parseFloat(rev.week_revenue || 0).toFixed(2)),
            prevWeek: Number(parseFloat(rev.prev_week_revenue || 0).toFixed(2)),
            weekDeltaPct: calcDeltaPct(rev.week_revenue, rev.prev_week_revenue),
            month: Number(parseFloat(rev.month_revenue || 0).toFixed(2)),
            prevMonth: Number(parseFloat(rev.prev_month_revenue || 0).toFixed(2)),
            monthDeltaPct: calcDeltaPct(rev.month_revenue, rev.prev_month_revenue),
            totalOrders: parseInt(rev.total_orders || 0, 10),
            todayOrders: parseInt(rev.today_orders || 0, 10),
            yesterdayOrders: parseInt(rev.yesterday_orders || 0, 10),
            byPackage: revByPkgRes.rows.map((r) => ({
                name: r.name,
                orders: r.orders,
                revenue: Number(parseFloat(r.revenue || 0).toFixed(2)),
                coins: r.coins,
                sharePct: totalRevNum > 0 ? Number(((parseFloat(r.revenue || 0) / totalRevNum) * 100).toFixed(1)) : 0
            })),
            byMethod: revByMethodRes.rows.map((r) => ({
                method: r.method,
                orders: r.orders,
                revenue: Number(parseFloat(r.revenue || 0).toFixed(2))
            }))
        },
        userGrowth: {
            total: totalUsersNum,
            today: parseInt(usr.today_users || 0, 10),
            yesterday: parseInt(usr.yesterday_users || 0, 10),
            todayDeltaPct: calcDeltaPct(usr.today_users, usr.yesterday_users),
            week: parseInt(usr.week_users || 0, 10),
            prevWeek: parseInt(usr.prev_week_users || 0, 10),
            weekDeltaPct: calcDeltaPct(usr.week_users, usr.prev_week_users),
            month: parseInt(usr.month_users || 0, 10),
            prevMonth: parseInt(usr.prev_month_users || 0, 10),
            monthDeltaPct: calcDeltaPct(usr.month_users, usr.prev_month_users),
            zeroCoinUsers: parseInt(usr.zero_coin_users || 0, 10),
            activePremiumUsers: parseInt(usr.active_premium_users || 0, 10),
            topCities: topCitiesRes.rows,
            gender: genderRes.rows[0]
        },
        monetization: {
            payingUsers: payingUsersNum,
            repeatBuyers: parseInt(rev.repeat_buyers || 0, 10),
            conversionRatePct: totalUsersNum > 0 ? Number(((payingUsersNum / totalUsersNum) * 100).toFixed(1)) : 0,
            repeatRatePct: payingUsersNum > 0 ? Number(((parseInt(rev.repeat_buyers || 0, 10) / payingUsersNum) * 100).toFixed(1)) : 0,
            arpu: totalUsersNum > 0 ? Number((totalRevNum / totalUsersNum).toFixed(2)) : 0,
            arppu: payingUsersNum > 0 ? Number((totalRevNum / payingUsersNum).toFixed(2)) : 0,
            avgOrderValue: rev.total_orders > 0 ? Number((totalRevNum / rev.total_orders).toFixed(2)) : 0
        },
        livePulse: {
            liveOnlineCount: activeIds.length,
            hotZeroCoinUsers: sanitizeAvatars(hotZeroCoinRes.rows),
            exhausted24h: sig.exhausted_24h || 0,
            pushUnregistered24h: sig.push_unreg_24h || 0,
            aiHooksTotal: sig.ai_hooks_total || 0,
            aiHooksPaid: sig.ai_hooks_paid || 0,
            aiHookConversionPct: sig.ai_hooks_total > 0 ? Number(((sig.ai_hooks_paid / sig.ai_hooks_total) * 100).toFixed(1)) : 0
        },
        funnel: {
            all: f ? {
                registered: f.all_registered,
                onboarded: f.all_onboarded,
                messaged: f.all_messaged,
                exhausted: f.all_exhausted,
                paid: f.all_paid,
                repeat: f.all_repeat
            } : {},
            week7d: f ? {
                registered: f.w7_registered,
                onboarded: f.w7_onboarded,
                messaged: f.w7_messaged,
                exhausted: f.w7_exhausted,
                paid: f.w7_paid,
                repeat: f.w7_repeat
            } : {}
        },
        adQuality: {
            total7d: sp.total_7d || 0,
            paid7d: sp.paid_7d || 0,
            paidWithin30m7d: sp.paid_within_30m_7d || 0,
            within30mPct7d: sp.total_7d > 0 ? Number(((sp.paid_within_30m_7d / sp.total_7d) * 100).toFixed(1)) : 0,
            totalToday: sp.total_today || 0,
            paidWithin30mToday: sp.paid_within_30m_today || 0,
            within30mPctToday: sp.total_today > 0 ? Number(((sp.paid_within_30m_today / sp.total_today) * 100).toFixed(1)) : 0,
            avgMinutesToPay: sp.avg_minutes_to_pay || 0
        },
        loyalBuyers: sanitizeAvatars(loyalBuyersRes.rows).map((r) => ({
            ...r,
            total_tl: Number(parseFloat(r.total_tl || 0).toFixed(2)),
            is_active_premium: isUserPremiumActive({ role: 'user', ...r })
        })),
        expiringPremiums: sanitizeAvatars(expiringPremiumRes.rows),
        peakHours,
        recentPayments: sanitizeAvatars(recentPaymentsRes.rows).map((p) => ({
            ...p,
            amount: Number(parseFloat(p.amount || 0).toFixed(2))
        })),
        dailyReport: dailyReportRes.rows.map((row) => ({
            date: row.date,
            registered: row.registered,
            cohortPaying: row.cohort_paying,
            cohortRatePct: row.registered > 0 ? Number(((row.cohort_paying / row.registered) * 100).toFixed(1)) : 0,
            cohortRevenue: Number(parseFloat(row.cohort_revenue || 0).toFixed(2)),
            totalBuyers: row.total_buyers,
            totalOrders: row.total_orders,
            totalRevenue: Number(parseFloat(row.total_revenue || 0).toFixed(2))
        })),
        newUsers: {
            counts: {
                today: parseInt(np.today_count || 0, 10),
                yesterday: parseInt(np.yesterday_count || 0, 10),
                week: parseInt(np.week_count || 0, 10),
                month: parseInt(np.month_count || 0, 10)
            },
            periods: {
                today: formatPeriodSummary(np.today_count, np.yesterday_count, np.today_paying, np.today_rev),
                yesterday: formatPeriodSummary(np.yesterday_count, np.day_before_count, np.yesterday_paying, np.yesterday_rev),
                week: formatPeriodSummary(np.week_count, np.prev_week_count, np.week_paying, np.week_rev),
                month: formatPeriodSummary(np.month_count, np.prev_month_count, np.month_paying, np.month_rev)
            },
            lists: {
                today: sanitizeAvatars(newUsersTodayListRes.rows),
                yesterday: sanitizeAvatars(newUsersYesterdayListRes.rows),
                week: sanitizeAvatars(newUsersWeekListRes.rows),
                month: sanitizeAvatars(newUsersMonthListRes.rows)
            }
        }
    };
}

function fetchNewUsersPeriodList(whereTimeClause, activeIds) {
    return db.query(`
        SELECT u.id, u.username, u.display_name, u.email, u.gender, u.city, u.age,
               u.balance, u.vip_level, u.is_premium, u.premium_expire_date, u.vip_expire_date,
               u.created_at, u.avatar_url,
               (u.id::text = ANY($1::text[])) AS is_online,
               COALESCE((SELECT COUNT(*) FROM payments p WHERE p.user_id::text = u.id::text AND COALESCE(p.status, 'completed') = 'completed'), 0)::int AS payment_count,
               COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.user_id::text = u.id::text AND COALESCE(p.status, 'completed') = 'completed'), 0)::numeric(12,2) AS paid_total
        FROM users u
        WHERE u.role = 'user'
          AND COALESCE(u.account_status, 'active') != 'deleted'
          AND (${whereTimeClause})
        ORDER BY u.created_at DESC
        LIMIT 20
    `, [activeIds]);
}

/**
 * Date-range drill-down endpoint powering KPI drawers and New Users custom date picker.
 */
async function getDashboardRangeStats(req) {
    const { start, end } = parseDateRange(req.query.start, req.query.end);
    const activeIds = getActiveCustomerIds();

    const rangeSql = `
        WITH rng AS (
            SELECT
                (($1::date)::timestamp AT TIME ZONE '${TR_TZ}') AS s_at,
                ((($2::date + 1)::timestamp) AT TIME ZONE '${TR_TZ}') AS e_at
        ),
        prev_rng AS (
            SELECT
                (s_at - (e_at - s_at)) AS p_start,
                s_at AS p_end
            FROM rng
        )
    `;

    const [revRes, revDailyRes, revPkgRes, payListRes, usersSummaryRes, usersDailyRes, usersListRes] = await Promise.all([
        db.query(`
            ${rangeSql}
            SELECT
                COALESCE(SUM(p.amount) FILTER (WHERE p.created_at >= rng.s_at AND p.created_at < rng.e_at), 0)::numeric(12,2) AS total_revenue,
                COUNT(*) FILTER (WHERE p.created_at >= rng.s_at AND p.created_at < rng.e_at)::int AS total_orders,
                COUNT(DISTINCT p.user_id) FILTER (WHERE p.created_at >= rng.s_at AND p.created_at < rng.e_at)::int AS paying_users,
                COALESCE(SUM(p.amount) FILTER (WHERE p.created_at >= prev_rng.p_start AND p.created_at < prev_rng.p_end), 0)::numeric(12,2) AS prev_revenue,
                COUNT(*) FILTER (WHERE p.created_at >= prev_rng.p_start AND p.created_at < prev_rng.p_end)::int AS prev_orders
            FROM payments p CROSS JOIN rng CROSS JOIN prev_rng
            WHERE COALESCE(p.status, 'completed') = 'completed'
              AND p.created_at >= prev_rng.p_start AND p.created_at < rng.e_at
        `, [start, end]),

        db.query(`
            SELECT TO_CHAR(p.created_at AT TIME ZONE '${TR_TZ}', 'DD.MM') AS label,
                   (p.created_at AT TIME ZONE '${TR_TZ}')::date AS day,
                   COALESCE(SUM(p.amount), 0)::numeric(12,2) AS revenue,
                   COUNT(*)::int AS orders
            FROM payments p
            WHERE COALESCE(p.status, 'completed') = 'completed'
              AND p.created_at >= (($1::date)::timestamp AT TIME ZONE '${TR_TZ}')
              AND p.created_at < ((($2::date + 1)::timestamp) AT TIME ZONE '${TR_TZ}')
            GROUP BY 1, 2
            ORDER BY 2 ASC
        `, [start, end]),

        db.query(`
            SELECT COALESCE(NULLIF(TRIM(p.package_name_snapshot), ''), cp.name, 'Diğer') AS name,
                   COUNT(*)::int AS orders,
                   COALESCE(SUM(p.amount), 0)::numeric(12,2) AS revenue
            FROM payments p
            LEFT JOIN coin_packages cp ON p.package_id = cp.id
            WHERE COALESCE(p.status, 'completed') = 'completed'
              AND p.created_at >= (($1::date)::timestamp AT TIME ZONE '${TR_TZ}')
              AND p.created_at < ((($2::date + 1)::timestamp) AT TIME ZONE '${TR_TZ}')
            GROUP BY 1
            ORDER BY revenue DESC
        `, [start, end]),

        db.query(`
            SELECT p.id, p.user_id, p.amount, p.coin_amount, p.payment_method, p.created_at,
                   COALESCE(NULLIF(TRIM(p.package_name_snapshot), ''), cp.name, 'Paket') AS package_name,
                   COALESCE(u.display_name, u.username, 'Kullanıcı') AS user_name,
                   u.email AS user_email
            FROM payments p
            LEFT JOIN users u ON p.user_id::text = u.id::text
            LEFT JOIN coin_packages cp ON p.package_id = cp.id
            WHERE COALESCE(p.status, 'completed') = 'completed'
              AND p.created_at >= (($1::date)::timestamp AT TIME ZONE '${TR_TZ}')
              AND p.created_at < ((($2::date + 1)::timestamp) AT TIME ZONE '${TR_TZ}')
            ORDER BY p.created_at DESC
            LIMIT 40
        `, [start, end]),

        db.query(`
            ${rangeSql},
            u_pay AS (
                SELECT u.id, u.created_at,
                       COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.user_id::text = u.id::text AND COALESCE(p.status, 'completed') = 'completed'), 0)::numeric(12,2) AS paid_tl
                FROM users u
                WHERE u.role = 'user' AND COALESCE(u.account_status, 'active') != 'deleted'
            )
            SELECT
                COUNT(*) FILTER (WHERE u.created_at >= rng.s_at AND u.created_at < rng.e_at)::int AS total_users,
                COUNT(*) FILTER (WHERE u.created_at >= rng.s_at AND u.created_at < rng.e_at AND u.paid_tl > 0)::int AS paying_users,
                COALESCE(SUM(u.paid_tl) FILTER (WHERE u.created_at >= rng.s_at AND u.created_at < rng.e_at), 0)::numeric(12,2) AS user_cohort_revenue,
                COUNT(*) FILTER (WHERE u.created_at >= prev_rng.p_start AND u.created_at < prev_rng.p_end)::int AS prev_users
            FROM u_pay u CROSS JOIN rng CROSS JOIN prev_rng
            WHERE u.created_at >= prev_rng.p_start AND u.created_at < rng.e_at
        `, [start, end]),

        db.query(`
            SELECT TO_CHAR(created_at AT TIME ZONE '${TR_TZ}', 'DD.MM') AS label,
                   (created_at AT TIME ZONE '${TR_TZ}')::date AS day,
                   COUNT(*)::int AS count
            FROM users
            WHERE role = 'user'
              AND COALESCE(account_status, 'active') != 'deleted'
              AND created_at >= (($1::date)::timestamp AT TIME ZONE '${TR_TZ}')
              AND created_at < ((($2::date + 1)::timestamp) AT TIME ZONE '${TR_TZ}')
            GROUP BY 1, 2
            ORDER BY 2 ASC
        `, [start, end]),

        fetchNewUsersPeriodList(
            `u.created_at >= (($2::date)::timestamp AT TIME ZONE '${TR_TZ}') AND u.created_at < ((($3::date + 1)::timestamp) AT TIME ZONE '${TR_TZ}')`,
            activeIds
        ).catch(() => ({ rows: [] }))
    ]);

    // fetchNewUsersPeriodList takes only $1=[activeIds]; let's run the custom range user list cleanly with explicit params
    const customUsersListRes = await db.query(`
        SELECT u.id, u.username, u.display_name, u.email, u.gender, u.city, u.age,
               u.balance, u.vip_level, u.is_premium, u.premium_expire_date, u.vip_expire_date,
               u.created_at, u.avatar_url,
               (u.id::text = ANY($1::text[])) AS is_online,
               COALESCE((SELECT COUNT(*) FROM payments p WHERE p.user_id::text = u.id::text AND COALESCE(p.status, 'completed') = 'completed'), 0)::int AS payment_count,
               COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.user_id::text = u.id::text AND COALESCE(p.status, 'completed') = 'completed'), 0)::numeric(12,2) AS paid_total
        FROM users u
        WHERE u.role = 'user'
          AND COALESCE(u.account_status, 'active') != 'deleted'
          AND u.created_at >= (($2::date)::timestamp AT TIME ZONE '${TR_TZ}')
          AND u.created_at < ((($3::date + 1)::timestamp) AT TIME ZONE '${TR_TZ}')
        ORDER BY u.created_at DESC
        LIMIT 30
    `, [activeIds, start, end]);

    const r = revRes.rows[0];
    const u = usersSummaryRes.rows[0];
    const rangeTotalUsers = parseInt(u.total_users || 0, 10);
    const rangePayingUsers = parseInt(u.paying_users || 0, 10);

    return {
        range: { start, end },
        revenue: {
            total: Number(parseFloat(r.total_revenue || 0).toFixed(2)),
            prevTotal: Number(parseFloat(r.prev_revenue || 0).toFixed(2)),
            deltaPct: calcDeltaPct(r.total_revenue, r.prev_revenue),
            orders: r.total_orders || 0,
            prevOrders: r.prev_orders || 0,
            payingUsers: r.paying_users || 0,
            daily: revDailyRes.rows.map((d) => ({ ...d, revenue: Number(parseFloat(d.revenue || 0).toFixed(2)) })),
            byPackage: revPkgRes.rows.map((d) => ({ ...d, revenue: Number(parseFloat(d.revenue || 0).toFixed(2)) })),
            payments: payListRes.rows.map((p) => ({ ...p, amount: Number(parseFloat(p.amount || 0).toFixed(2)) }))
        },
        users: {
            total: rangeTotalUsers,
            prevTotal: parseInt(u.prev_users || 0, 10),
            deltaPct: calcDeltaPct(rangeTotalUsers, u.prev_users),
            payingCount: rangePayingUsers,
            payingRatePct: rangeTotalUsers > 0 ? Number(((rangePayingUsers / rangeTotalUsers) * 100).toFixed(1)) : 0,
            cohortRevenue: Number(parseFloat(u.user_cohort_revenue || 0).toFixed(2)),
            daily: usersDailyRes.rows,
            list: customUsersListRes.rows.map((row) => {
                const cleaned = sanitizeUser({ avatar_url: row.avatar_url }, req);
                return { ...row, avatar_url: cleaned ? cleaned.avatar_url : row.avatar_url };
            })
        }
    };
}

module.exports = {
    getDashboardOverviewStats,
    getDashboardRangeStats
};
