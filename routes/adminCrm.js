const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// All CRM routes require admin or super_admin
router.use(authenticateToken, authorizeRole('admin', 'super_admin'));

function computeSegment(row) {
    const spent = parseFloat(row.real_spent_amount || 0);
    const purchases = parseInt(row.purchase_count || 0, 10);
    const vipLevel = parseInt(row.vip_level || 0, 10);
    const lastSeen = row.last_login_at || row.created_at;
    const daysSinceSeen = lastSeen ? (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24) : 0;

    if (purchases >= 1 && daysSinceSeen >= 7) return 'churn_risk';
    if (spent >= 1000 || vipLevel >= 2) return 'vip';
    if (purchases >= 2) return 'repeat';
    if (purchases === 1) return 'first_time';
    if (row.ai_hook_sent) return 'free_hooked';
    return 'free';
}

function buildCustomerCteSql() {
    return `
        WITH payment_agg AS (
            SELECT
                p.user_id::text AS uid,
                COUNT(*) FILTER (WHERE COALESCE(p.status, 'completed') = 'completed') AS purchase_count,
                COALESCE(SUM(p.amount) FILTER (WHERE COALESCE(p.status, 'completed') = 'completed'), 0) AS real_spent_amount,
                COALESCE(SUM(COALESCE(p.coin_amount, cp.coins, 0)) FILTER (WHERE COALESCE(p.status, 'completed') = 'completed'), 0) AS purchased_coins,
                MIN(p.created_at) FILTER (WHERE COALESCE(p.status, 'completed') = 'completed') AS first_purchase_at,
                MAX(p.created_at) FILTER (WHERE COALESCE(p.status, 'completed') = 'completed') AS last_purchase_at,
                (ARRAY_AGG(
                    COALESCE(p.package_name_snapshot, cp.name, CONCAT(COALESCE(p.coin_amount, cp.coins, 0), ' Coin'))
                    ORDER BY p.created_at DESC
                ) FILTER (WHERE COALESCE(p.status, 'completed') = 'completed'))[1] AS last_package_name,
                (ARRAY_AGG(
                    p.package_id
                    ORDER BY p.created_at DESC
                ) FILTER (WHERE COALESCE(p.status, 'completed') = 'completed'))[1] AS last_package_id
            FROM payments p
            LEFT JOIN coin_packages cp ON p.package_id = cp.id
            GROUP BY p.user_id::text
        ),
        tx_agg AS (
            SELECT
                t.user_id::text AS uid,
                COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0 AND t.type NOT IN ('purchase', 'webhook_purchase', 'starter_pack')), 0) AS bonus_coins,
                COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0 AND t.type IN ('admin_grant', 'admin_deduct')), 0) AS admin_granted_coins,
                COALESCE(SUM(ABS(t.amount)) FILTER (WHERE t.amount < 0), 0) AS recorded_spent_coins
            FROM transactions t
            GROUP BY t.user_id::text
        )
    `;
}

/**
 * GET /api/admin/crm/summary
 * Overall CRM & revenue intelligence KPIs
 */
router.get('/summary', async (req, res) => {
    try {
        const kpiRes = await db.query(`
            WITH u_stats AS (
                SELECT
                    COUNT(*) FILTER (WHERE role = 'user') AS total_users,
                    COALESCE(SUM(balance) FILTER (WHERE role = 'user'), 0) AS total_current_balance
                FROM users
            ),
            p_user AS (
                SELECT
                    p.user_id::text AS uid,
                    COUNT(*) AS cnt,
                    SUM(p.amount) AS total_amt,
                    SUM(COALESCE(p.coin_amount, cp.coins, 0)) AS coins_given
                FROM payments p
                JOIN users u ON p.user_id::text = u.id::text
                LEFT JOIN coin_packages cp ON p.package_id = cp.id
                WHERE u.role = 'user' AND COALESCE(p.status, 'completed') = 'completed'
                GROUP BY p.user_id::text
            ),
            p_totals AS (
                SELECT
                    COUNT(*) AS paying_users,
                    COUNT(*) FILTER (WHERE cnt >= 2) AS repeat_buyers,
                    COALESCE(SUM(total_amt), 0) AS total_revenue,
                    COALESCE(SUM(coins_given), 0) AS total_purchased_coins
                FROM p_user
            ),
            p_periods AS (
                SELECT
                    COALESCE(SUM(p.amount) FILTER (WHERE p.created_at >= NOW() - INTERVAL '30 days'), 0) AS revenue_30d,
                    COALESCE(SUM(p.amount) FILTER (WHERE p.created_at >= DATE_TRUNC('day', NOW())), 0) AS revenue_today
                FROM payments p
                JOIN users u ON p.user_id::text = u.id::text
                WHERE u.role = 'user' AND COALESCE(p.status, 'completed') = 'completed'
            ),
            t_totals AS (
                SELECT
                    COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0 AND t.type NOT IN ('purchase', 'webhook_purchase', 'starter_pack')), 0) AS total_bonus_coins,
                    COALESCE(SUM(ABS(t.amount)) FILTER (WHERE t.amount < 0), 0) AS total_recorded_spent_coins
                FROM transactions t
                JOIN users u ON t.user_id::text = u.id::text
                WHERE u.role = 'user'
            )
            SELECT * FROM u_stats, p_totals, p_periods, t_totals
        `);

        const pkgBreakdownRes = await db.query(`
            SELECT
                COALESCE(p.package_name_snapshot, cp.name, CONCAT(COALESCE(p.coin_amount, cp.coins, 0), ' Coin')) AS package_name,
                COUNT(*) AS sales_count,
                COUNT(DISTINCT p.user_id) AS unique_buyers,
                COALESCE(SUM(p.amount), 0) AS total_revenue,
                COALESCE(SUM(COALESCE(p.coin_amount, cp.coins, 0)), 0) AS total_coins
            FROM payments p
            JOIN users u ON p.user_id::text = u.id::text
            LEFT JOIN coin_packages cp ON p.package_id = cp.id
            WHERE u.role = 'user' AND COALESCE(p.status, 'completed') = 'completed'
            GROUP BY COALESCE(p.package_name_snapshot, cp.name, CONCAT(COALESCE(p.coin_amount, cp.coins, 0), ' Coin'))
            ORDER BY total_revenue DESC
            LIMIT 12
        `);

        const k = kpiRes.rows[0] || {};
        const totalUsers = parseInt(k.total_users || 0, 10);
        const payingUsers = parseInt(k.paying_users || 0, 10);
        const repeatBuyers = parseInt(k.repeat_buyers || 0, 10);
        const totalRevenue = parseFloat(k.total_revenue || 0);
        const totalPurchasedCoins = parseInt(k.total_purchased_coins || 0, 10);
        const totalBonusCoins = parseInt(k.total_bonus_coins || 0, 10);
        const totalCurrentBalance = parseInt(k.total_current_balance || 0, 10);
        const recordedSpent = parseInt(k.total_recorded_spent_coins || 0, 10);

        res.json({
            total_users: totalUsers,
            paying_users: payingUsers,
            conversion_rate: totalUsers > 0 ? Number(((payingUsers / totalUsers) * 100).toFixed(1)) : 0,
            repeat_buyers: repeatBuyers,
            repeat_rate: payingUsers > 0 ? Number(((repeatBuyers / payingUsers) * 100).toFixed(1)) : 0,
            total_revenue: totalRevenue,
            revenue_30d: parseFloat(k.revenue_30d || 0),
            revenue_today: parseFloat(k.revenue_today || 0),
            arppu: payingUsers > 0 ? Number((totalRevenue / payingUsers).toFixed(2)) : 0,
            arpu: totalUsers > 0 ? Number((totalRevenue / totalUsers).toFixed(2)) : 0,
            total_purchased_coins: totalPurchasedCoins,
            total_bonus_coins: totalBonusCoins,
            total_coins_granted: totalPurchasedCoins + totalBonusCoins,
            total_spent_coins: recordedSpent,
            total_current_balance: totalCurrentBalance,
            package_breakdown: pkgBreakdownRes.rows.map(r => ({
                package_name: r.package_name,
                sales_count: parseInt(r.sales_count || 0, 10),
                unique_buyers: parseInt(r.unique_buyers || 0, 10),
                total_revenue: parseFloat(r.total_revenue || 0),
                total_coins: parseInt(r.total_coins || 0, 10)
            }))
        });
    } catch (err) {
        console.error('[CRM SUMMARY ERROR]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Build filtered customer rows (shared by /customers and /export)
 */
async function queryCustomers({ search = '', segment = 'all', packageFilter = '', minSpent = 0, sortBy = 'real_spent_desc', limit = 50, offset = 0 }) {
    const params = [];
    const whereClauses = ["u.role = 'user'"];

    if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        const idx = params.length;
        whereClauses.push(`(u.username ILIKE $${idx} OR u.display_name ILIKE $${idx} OR u.email ILIKE $${idx} OR COALESCE(u.phone, '') ILIKE $${idx} OR u.id::text ILIKE $${idx})`);
    }

    if (minSpent && parseFloat(minSpent) > 0) {
        params.push(parseFloat(minSpent));
        whereClauses.push(`COALESCE(pa.real_spent_amount, 0) >= $${params.length}`);
    }

    if (packageFilter && packageFilter.trim()) {
        params.push(packageFilter.trim());
        whereClauses.push(`EXISTS (
            SELECT 1 FROM payments p2
            LEFT JOIN coin_packages cp2 ON p2.package_id = cp2.id
            WHERE p2.user_id::text = u.id::text
              AND COALESCE(p2.status, 'completed') = 'completed'
              AND COALESCE(p2.package_name_snapshot, cp2.name, CONCAT(COALESCE(p2.coin_amount, cp2.coins, 0), ' Coin')) = $${params.length}
        )`);
    }

    if (segment === 'vip') {
        whereClauses.push(`(COALESCE(pa.real_spent_amount, 0) >= 1000 OR COALESCE(u.vip_level, 0) >= 2)`);
    } else if (segment === 'repeat') {
        whereClauses.push(`COALESCE(pa.purchase_count, 0) >= 2`);
    } else if (segment === 'first_time') {
        whereClauses.push(`COALESCE(pa.purchase_count, 0) = 1`);
    } else if (segment === 'free_hooked') {
        whereClauses.push(`COALESCE(pa.purchase_count, 0) = 0 AND COALESCE(u.ai_hook_sent, false) = true`);
    } else if (segment === 'free') {
        whereClauses.push(`COALESCE(pa.purchase_count, 0) = 0`);
    } else if (segment === 'churn_risk') {
        whereClauses.push(`COALESCE(pa.purchase_count, 0) >= 1 AND COALESCE(u.last_login_at, u.created_at) < NOW() - INTERVAL '7 days'`);
    }

    const orderMap = {
        real_spent_desc: 'real_spent_amount DESC, purchase_count DESC, u.created_at DESC',
        spent_coins_desc: 'effective_spent_coins DESC, real_spent_amount DESC',
        balance_desc: 'u.balance DESC NULLS LAST',
        purchases_desc: 'purchase_count DESC, real_spent_amount DESC',
        recent_active: 'COALESCE(u.last_login_at, u.created_at) DESC',
        newest: 'u.created_at DESC'
    };
    const orderClause = orderMap[sortBy] || orderMap.real_spent_desc;

    const baseWhere = whereClauses.join(' AND ');
    const cte = buildCustomerCteSql();

    const countQuery = `
        ${cte}
        SELECT COUNT(*) AS total
        FROM users u
        LEFT JOIN payment_agg pa ON pa.uid = u.id::text
        WHERE ${baseWhere}
    `;

    const dataParams = [...params, limit, offset];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const dataQuery = `
        ${cte}
        SELECT
            u.id,
            u.username,
            COALESCE(u.display_name, u.name, u.username) AS display_name,
            u.email,
            u.phone,
            u.avatar_url,
            u.gender,
            u.age,
            u.city,
            COALESCE(u.balance, 0) AS balance,
            COALESCE(u.vip_level, 0) AS vip_level,
            COALESCE(u.is_vip, false) AS is_vip,
            COALESCE(u.is_premium, false) AS is_premium,
            COALESCE(u.account_status, 'active') AS account_status,
            COALESCE(u.ai_messages_count, 0) AS ai_messages_count,
            COALESCE(u.ai_hook_sent, false) AS ai_hook_sent,
            u.admin_notes,
            u.created_at,
            u.last_login_at,
            COALESCE(pa.purchase_count, 0) AS purchase_count,
            COALESCE(pa.real_spent_amount, 0) AS real_spent_amount,
            COALESCE(pa.purchased_coins, 0) AS purchased_coins,
            pa.first_purchase_at,
            pa.last_purchase_at,
            pa.last_package_name,
            COALESCE(ta.bonus_coins, 0) AS bonus_coins,
            COALESCE(ta.admin_granted_coins, 0) AS admin_granted_coins,
            COALESCE(ta.recorded_spent_coins, 0) AS recorded_spent_coins,
            (COALESCE(pa.purchased_coins, 0) + COALESCE(ta.bonus_coins, 0)) AS total_coins_granted,
            GREATEST(
                COALESCE(ta.recorded_spent_coins, 0),
                GREATEST(0, (COALESCE(pa.purchased_coins, 0) + COALESCE(ta.bonus_coins, 0)) - COALESCE(u.balance, 0))
            ) AS effective_spent_coins
        FROM users u
        LEFT JOIN payment_agg pa ON pa.uid = u.id::text
        LEFT JOIN tx_agg ta ON ta.uid = u.id::text
        WHERE ${baseWhere}
        ORDER BY ${orderClause}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const [countRes, dataRes] = await Promise.all([
        db.query(countQuery, params),
        db.query(dataQuery, dataParams)
    ]);

    const customers = dataRes.rows.map(r => ({
        ...r,
        purchase_count: parseInt(r.purchase_count || 0, 10),
        real_spent_amount: parseFloat(r.real_spent_amount || 0),
        purchased_coins: parseInt(r.purchased_coins || 0, 10),
        bonus_coins: parseInt(r.bonus_coins || 0, 10),
        admin_granted_coins: parseInt(r.admin_granted_coins || 0, 10),
        recorded_spent_coins: parseInt(r.recorded_spent_coins || 0, 10),
        total_coins_granted: parseInt(r.total_coins_granted || 0, 10),
        effective_spent_coins: parseInt(r.effective_spent_coins || 0, 10),
        balance: parseInt(r.balance || 0, 10),
        segment: computeSegment(r)
    }));

    return {
        total: parseInt(countRes.rows[0]?.total || 0, 10),
        customers
    };
}

/**
 * GET /api/admin/crm/customers
 */
router.get('/customers', async (req, res) => {
    try {
        const { search = '', segment = 'all', packageFilter = '', minSpent = 0, sortBy = 'real_spent_desc', page = 1, limit = 50 } = req.query;
        const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const data = await queryCustomers({
            search,
            segment,
            packageFilter,
            minSpent,
            sortBy,
            limit: parsedLimit,
            offset
        });

        res.json({
            ...data,
            page: parsedPage,
            limit: parsedLimit,
            total_pages: Math.max(1, Math.ceil(data.total / parsedLimit))
        });
    } catch (err) {
        console.error('[CRM CUSTOMERS ERROR]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/crm/export
 * CSV Export of filtered CRM customers
 */
router.get('/export', async (req, res) => {
    try {
        const { search = '', segment = 'all', packageFilter = '', minSpent = 0, sortBy = 'real_spent_desc' } = req.query;
        const { customers } = await queryCustomers({
            search,
            segment,
            packageFilter,
            minSpent,
            sortBy,
            limit: 5000,
            offset: 0
        });

        const escapeCsv = (val) => {
            const s = (val === null || val === undefined) ? '' : String(val);
            return `"${s.replace(/"/g, '""')}"`;
        };

        const headers = [
            'ID', 'Ad Soyad', 'Kullanıcı Adı', 'E-posta', 'Telefon', 'Segment', 'VIP Seviyesi',
            'Toplam Ödenen (TL)', 'Satın Alım Adedi', 'Son Alınan Paket',
            'Satın Alınan Coin', 'Bonus/Admin Coin', 'Toplam Verilen Coin', 'Harcanan Coin', 'Kalan Bakiye',
            'AI Mesaj Sayacı', 'Numara Onay Hook', 'Kayıt Tarihi', 'Son Aktiflik'
        ];

        const lines = [headers.map(escapeCsv).join(';')];
        for (const c of customers) {
            lines.push([
                c.id,
                c.display_name,
                c.username,
                c.email,
                c.phone || '',
                c.segment,
                c.vip_level,
                c.real_spent_amount,
                c.purchase_count,
                c.last_package_name || '',
                c.purchased_coins,
                c.bonus_coins,
                c.total_coins_granted,
                c.effective_spent_coins,
                c.balance,
                `${c.ai_messages_count}/5`,
                c.ai_hook_sent ? 'Evet' : 'Hayır',
                c.created_at ? new Date(c.created_at).toISOString() : '',
                c.last_login_at ? new Date(c.last_login_at).toISOString() : ''
            ].map(escapeCsv).join(';'));
        }

        const csv = '\uFEFF' + lines.join('\r\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="fiora-crm-musteriler-${Date.now()}.csv"`);
        res.send(csv);
    } catch (err) {
        console.error('[CRM EXPORT ERROR]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/admin/crm/customers/:userId
 * 360-degree detailed customer intelligence view
 */
router.get('/customers/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const cte = buildCustomerCteSql();

        const userRes = await db.query(`
            ${cte}
            SELECT
                u.id, u.username, COALESCE(u.display_name, u.name, u.username) AS display_name,
                u.email, u.phone, u.avatar_url, u.gender, u.age, u.city,
                COALESCE(u.balance, 0) AS balance,
                COALESCE(u.vip_level, 0) AS vip_level,
                COALESCE(u.vip_xp, 0) AS vip_xp,
                COALESCE(u.is_vip, false) AS is_vip,
                COALESCE(u.is_premium, false) AS is_premium,
                u.premium_expire_date,
                COALESCE(u.account_status, 'active') AS account_status,
                COALESCE(u.ai_messages_count, 0) AS ai_messages_count,
                COALESCE(u.ai_hook_sent, false) AS ai_hook_sent,
                u.admin_notes, u.referred_by, u.created_at, u.last_login_at,
                COALESCE(pa.purchase_count, 0) AS purchase_count,
                COALESCE(pa.real_spent_amount, 0) AS real_spent_amount,
                COALESCE(pa.purchased_coins, 0) AS purchased_coins,
                pa.first_purchase_at, pa.last_purchase_at, pa.last_package_name,
                COALESCE(ta.bonus_coins, 0) AS bonus_coins,
                COALESCE(ta.admin_granted_coins, 0) AS admin_granted_coins,
                COALESCE(ta.recorded_spent_coins, 0) AS recorded_spent_coins,
                (COALESCE(pa.purchased_coins, 0) + COALESCE(ta.bonus_coins, 0)) AS total_coins_granted,
                GREATEST(
                    COALESCE(ta.recorded_spent_coins, 0),
                    GREATEST(0, (COALESCE(pa.purchased_coins, 0) + COALESCE(ta.bonus_coins, 0)) - COALESCE(u.balance, 0))
                ) AS effective_spent_coins
            FROM users u
            LEFT JOIN payment_agg pa ON pa.uid = u.id::text
            LEFT JOIN tx_agg ta ON ta.uid = u.id::text
            WHERE u.id::text = $1::text
            LIMIT 1
        `, [userId]);

        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const rawUser = userRes.rows[0];
        const profile = {
            ...rawUser,
            purchase_count: parseInt(rawUser.purchase_count || 0, 10),
            real_spent_amount: parseFloat(rawUser.real_spent_amount || 0),
            purchased_coins: parseInt(rawUser.purchased_coins || 0, 10),
            bonus_coins: parseInt(rawUser.bonus_coins || 0, 10),
            admin_granted_coins: parseInt(rawUser.admin_granted_coins || 0, 10),
            recorded_spent_coins: parseInt(rawUser.recorded_spent_coins || 0, 10),
            total_coins_granted: parseInt(rawUser.total_coins_granted || 0, 10),
            effective_spent_coins: parseInt(rawUser.effective_spent_coins || 0, 10),
            balance: parseInt(rawUser.balance || 0, 10),
            segment: computeSegment(rawUser)
        };

        const [paymentsRes, pkgSummaryRes, txRes, txSpendRes, msgStatsRes, topOpsRes] = await Promise.all([
            // 1. All payments
            db.query(`
                SELECT
                    p.id, p.transaction_id, p.amount, p.status, p.created_at,
                    p.payment_method,
                    COALESCE(p.coin_amount, cp.coins, 0) AS coins_given,
                    COALESCE(p.package_name_snapshot, cp.name, CONCAT(COALESCE(p.coin_amount, cp.coins, 0), ' Coin')) AS package_name
                FROM payments p
                LEFT JOIN coin_packages cp ON p.package_id = cp.id
                WHERE p.user_id::text = $1::text
                ORDER BY p.created_at DESC
            `, [userId]),

            // 2. Package summary for this user
            db.query(`
                SELECT
                    COALESCE(p.package_name_snapshot, cp.name, CONCAT(COALESCE(p.coin_amount, cp.coins, 0), ' Coin')) AS package_name,
                    COUNT(*) AS count,
                    COALESCE(SUM(p.amount), 0) AS total_amount,
                    COALESCE(SUM(COALESCE(p.coin_amount, cp.coins, 0)), 0) AS total_coins
                FROM payments p
                LEFT JOIN coin_packages cp ON p.package_id = cp.id
                WHERE p.user_id::text = $1::text AND COALESCE(p.status, 'completed') = 'completed'
                GROUP BY COALESCE(p.package_name_snapshot, cp.name, CONCAT(COALESCE(p.coin_amount, cp.coins, 0), ' Coin'))
                ORDER BY total_amount DESC
            `, [userId]),

            // 3. Recent coin transactions
            db.query(`
                SELECT id, amount, type, description, created_at
                FROM transactions
                WHERE user_id::text = $1::text
                ORDER BY created_at DESC
                LIMIT 100
            `, [userId]),

            // 4. Spending breakdown from transactions
            db.query(`
                SELECT
                    type,
                    COUNT(*) AS count,
                    COALESCE(SUM(ABS(amount)), 0) AS total_coins
                FROM transactions
                WHERE user_id::text = $1::text AND amount < 0
                GROUP BY type
                ORDER BY total_coins DESC
            `, [userId]),

            // 5. Activity counts from messages (covers historical actions too)
            db.query(`
                SELECT
                    COUNT(*) FILTER (WHERE sender_id::text = $1::text AND content_type = 'text') AS text_sent,
                    COUNT(*) FILTER (WHERE sender_id::text = $1::text AND content_type IN ('image', 'video')) AS media_sent,
                    COUNT(*) FILTER (WHERE sender_id::text = $1::text AND content_type = 'audio') AS audio_sent,
                    COUNT(*) FILTER (WHERE sender_id::text = $1::text AND content_type = 'gift') AS gifts_sent,
                    COUNT(*) FILTER (WHERE sender_id::text != $1::text AND is_unlocked = true) AS media_unlocked
                FROM messages m
                JOIN chats c ON m.chat_id = c.id
                WHERE c.user_id::text = $1::text
            `, [userId]),

            // 6. Top operators interacted with
            db.query(`
                SELECT
                    op.id AS operator_id,
                    COALESCE(op.display_name, op.name, op.username) AS operator_name,
                    op.avatar_url AS operator_avatar,
                    c.id AS chat_id,
                    COUNT(m.id) FILTER (WHERE m.sender_id::text = $1::text) AS user_messages_count,
                    COUNT(m.id) FILTER (WHERE m.sender_id::text = op.id::text) AS operator_messages_count,
                    MAX(m.created_at) AS last_interaction_at
                FROM chats c
                JOIN users op ON c.operator_id = op.id
                LEFT JOIN messages m ON m.chat_id = c.id
                WHERE c.user_id::text = $1::text
                GROUP BY op.id, op.display_name, op.name, op.username, op.avatar_url, c.id
                ORDER BY user_messages_count DESC, last_interaction_at DESC NULLS LAST
                LIMIT 8
            `, [userId])
        ]);

        res.json({
            profile,
            payments: paymentsRes.rows.map(p => ({
                ...p,
                amount: parseFloat(p.amount || 0),
                coins_given: parseInt(p.coins_given || 0, 10)
            })),
            package_summary: pkgSummaryRes.rows.map(ps => ({
                package_name: ps.package_name,
                count: parseInt(ps.count || 0, 10),
                total_amount: parseFloat(ps.total_amount || 0),
                total_coins: parseInt(ps.total_coins || 0, 10)
            })),
            transactions: txRes.rows,
            spending_breakdown: txSpendRes.rows.map(s => ({
                type: s.type,
                count: parseInt(s.count || 0, 10),
                total_coins: parseInt(s.total_coins || 0, 10)
            })),
            activity_stats: msgStatsRes.rows[0] || {
                text_sent: 0,
                media_sent: 0,
                audio_sent: 0,
                gifts_sent: 0,
                media_unlocked: 0
            },
            top_operators: topOpsRes.rows
        });
    } catch (err) {
        console.error('[CRM CUSTOMER DETAIL ERROR]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/admin/crm/customers/:userId/notes
 * Save CRM admin note
 */
router.post('/customers/:userId/notes', async (req, res) => {
    try {
        const { userId } = req.params;
        const { notes } = req.body;
        await db.query('UPDATE users SET admin_notes = $1 WHERE id::text = $2::text', [notes || '', userId]);
        res.json({ success: true, admin_notes: notes || '' });
    } catch (err) {
        console.error('[CRM NOTES ERROR]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/admin/crm/customers/:userId/balance
 * Grant or deduct coins with mandatory reason logging in transactions (does NOT alter real-money total_spent)
 */
router.post('/customers/:userId/balance', async (req, res) => {
    try {
        const { userId } = req.params;
        const amount = parseInt(req.body.amount, 10);
        const reason = (req.body.reason || '').trim();

        if (isNaN(amount) || amount === 0) {
            return res.status(400).json({ error: 'Geçerli bir coin miktarı giriniz.' });
        }

        await db.query('BEGIN');
        const updRes = await db.query(
            'UPDATE users SET balance = GREATEST(0, COALESCE(balance, 0) + $1) WHERE id::text = $2::text RETURNING id, balance',
            [amount, userId]
        );

        if (updRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        const txType = amount > 0 ? 'admin_grant' : 'admin_deduct';
        const txDesc = reason || (amount > 0 ? 'CRM Admin Coin Yükleme' : 'CRM Admin Coin Kesintisi');
        await db.query(
            'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4)',
            [updRes.rows[0].id, amount, txType, txDesc]
        );
        await db.query('COMMIT');

        const newBalance = updRes.rows[0].balance;
        const io = req.app.get('io');
        if (io) {
            io.emit('balance_update', { userId: updRes.rows[0].id, newBalance });
            io.emit('admin_balance_update', { userId: updRes.rows[0].id, newBalance });
        }

        res.json({ success: true, newBalance });
    } catch (err) {
        await db.query('ROLLBACK').catch(() => {});
        console.error('[CRM BALANCE ERROR]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
