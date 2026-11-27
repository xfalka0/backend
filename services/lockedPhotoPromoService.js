const db = require('../db');
const { sendPushNotification } = require('../utils/notificationUtils');
const { getActiveCustomerIds } = require('../utils/autoMessageSystem');

const TR_TZ = 'Europe/Istanbul';

const PRE_MESSAGE_POOL = [
    'az önce çektim ama burdan açık atmaya utandım',
    'sadece sen gör diye kilitledim bak',
    'bunu sadece sana özel çektim bakalım beğenecek misin',
    'şimdi çektim atayım dedim ama açık atamadım',
    'sana özel bi şey çektim açıp baksana',
    'duştan yeni çıktım sana özel fotoğraf çektim',
    'kimseye atmadım bunu ilk sen gör istedim',
    'gece gece aklıma düştün sana özel bi şey atıyorum'
];

const OFFLINE_PUSH_PRE_MESSAGES = [
    'gündüz konuşmuştuk sana özel bi şey attım',
    'selam buralarda mısın sana özel fotoğraf attım',
    'az önce seni düşündüm sana özel bi şey çektim bak',
    'uyumadıysan girip baksana sana özel fotoğraf attım'
];

const inFlightUsers = new Set();
const scheduledConnectUsers = new Set();

let schemaPromise = null;
async function ensureLockedPhotoPromoSchema() {
    if (!schemaPromise) {
        schemaPromise = (async () => {
            await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_locked_promo_at TIMESTAMPTZ');
            await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_hook_sent_at TIMESTAMPTZ');

            await db.query(`
                CREATE TABLE IF NOT EXISTS locked_photo_pool (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(150),
                    image_url TEXT NOT NULL,
                    unlock_cost INTEGER NOT NULL DEFAULT 100,
                    pre_message TEXT,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    sent_count INTEGER NOT NULL DEFAULT 0,
                    insufficient_hits INTEGER NOT NULL DEFAULT 0,
                    unlock_count INTEGER NOT NULL DEFAULT 0,
                    purchase_conversion_count INTEGER NOT NULL DEFAULT 0,
                    conversion_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);

            await db.query(`
                CREATE TABLE IF NOT EXISTS admin_locked_promo_settings (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    default_unlock_cost INTEGER NOT NULL DEFAULT 100,
                    daily_cap INTEGER NOT NULL DEFAULT 1,
                    active_start_hour INTEGER NOT NULL DEFAULT 19,
                    active_end_hour INTEGER NOT NULL DEFAULT 1,
                    offline_start_minute INTEGER NOT NULL DEFAULT 1170,
                    offline_end_minute INTEGER NOT NULL DEFAULT 1320,
                    min_inactive_hours INTEGER NOT NULL DEFAULT 2,
                    max_inactive_days INTEGER NOT NULL DEFAULT 7,
                    numara_cooldown_hours INTEGER NOT NULL DEFAULT 5,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_admin_locked_promo_settings_singleton CHECK (id = 1)
                )
            `);

            await db.query(`
                INSERT INTO admin_locked_promo_settings (id)
                VALUES (1)
                ON CONFLICT (id) DO NOTHING
            `);

            const typeRes = await db.query(`
                SELECT
                    (SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = 'users'::regclass AND attname = 'id' AND NOT attisdropped) AS uid_type,
                    (SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = 'chats'::regclass AND attname = 'id' AND NOT attisdropped) AS cid_type,
                    (SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = 'messages'::regclass AND attname = 'id' AND NOT attisdropped) AS mid_type
            `);

            const uidType = typeRes.rows[0]?.uid_type || 'UUID';
            const cidType = typeRes.rows[0]?.cid_type || 'UUID';
            const midType = typeRes.rows[0]?.mid_type || 'UUID';

            await db.query(`
                CREATE TABLE IF NOT EXISTS locked_photo_deliveries (
                    id BIGSERIAL PRIMARY KEY,
                    photo_id INTEGER NOT NULL REFERENCES locked_photo_pool(id) ON DELETE CASCADE,
                    user_id ${uidType} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    operator_id ${uidType} REFERENCES users(id) ON DELETE SET NULL,
                    chat_id ${cidType} REFERENCES chats(id) ON DELETE SET NULL,
                    pre_message_id ${midType} REFERENCES messages(id) ON DELETE SET NULL,
                    message_id ${midType} REFERENCES messages(id) ON DELETE SET NULL,
                    trigger_type VARCHAR(32) NOT NULL,
                    pre_message_text TEXT,
                    unlock_cost INTEGER NOT NULL DEFAULT 100,
                    is_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
                    unlocked_at TIMESTAMPTZ,
                    insufficient_funds_hit_at TIMESTAMPTZ,
                    converted_to_purchase BOOLEAN NOT NULL DEFAULT FALSE,
                    converted_payment_id TEXT,
                    converted_amount NUMERIC(12, 2),
                    converted_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);

            await db.query('CREATE INDEX IF NOT EXISTS idx_locked_photo_deliveries_user_date ON locked_photo_deliveries(user_id, created_at DESC)');
            await db.query('CREATE INDEX IF NOT EXISTS idx_locked_photo_deliveries_user_photo ON locked_photo_deliveries(user_id, photo_id)');
            await db.query('CREATE INDEX IF NOT EXISTS idx_locked_photo_deliveries_message ON locked_photo_deliveries(message_id)');
        })().catch((err) => {
            schemaPromise = null;
            throw err;
        });
    }
    return schemaPromise;
}

function getIstanbulClock(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TR_TZ,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date);

    const hourRaw = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const minuteRaw = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    const hour = hourRaw === 24 ? 0 : hourRaw;
    const minute = minuteRaw;
    return { hour, minute, minutesOfDay: hour * 60 + minute };
}

function isInEveningActiveWindow(settings, clock = getIstanbulClock()) {
    const start = Number(settings?.active_start_hour ?? 19);
    const end = Number(settings?.active_end_hour ?? 1);
    if (start === end) return true;
    if (start < end) {
        return clock.hour >= start && clock.hour < end;
    }
    return clock.hour >= start || clock.hour < end;
}

function isInOfflinePushWindow(settings, clock = getIstanbulClock()) {
    const start = Number(settings?.offline_start_minute ?? 1170); // 19:30
    const end = Number(settings?.offline_end_minute ?? 1320); // 22:00
    if (start === end) return true;
    if (start < end) {
        return clock.minutesOfDay >= start && clock.minutesOfDay < end;
    }
    return clock.minutesOfDay >= start || clock.minutesOfDay < end;
}

async function getLockedPromoSettings() {
    await ensureLockedPhotoPromoSchema();
    const res = await db.query('SELECT * FROM admin_locked_promo_settings WHERE id = 1');
    return res.rows[0] || {
        id: 1,
        is_enabled: true,
        default_unlock_cost: 100,
        daily_cap: 1,
        active_start_hour: 19,
        active_end_hour: 1,
        offline_start_minute: 1170,
        offline_end_minute: 1320,
        min_inactive_hours: 2,
        max_inactive_days: 7,
        numara_cooldown_hours: 5,
    };
}

function resolveTargetOperatorGender(userGenderRaw) {
    const g = String(userGenderRaw || 'erkek').toLowerCase();
    return (g === 'kadin' || g === 'female') ? 'erkek' : 'kadin';
}

async function selectOperatorForLockedPhoto(userId, userGenderRaw) {
    const targetGender = resolveTargetOperatorGender(userGenderRaw);

    // 1. Öncelik: Kullanıcının daha önce yazıştığı aktif karşı cins operatör
    // (Son mesajı zaten locked_image/locked_video olan sohbete üst üste kilitli foto atılmaz)
    const recentChatOpRes = await db.query(`
        SELECT u.id, u.username, COALESCE(u.display_name, u.name, u.username) AS display_name, u.avatar_url,
               c.id AS existing_chat_id
        FROM chats c
        JOIN users u ON c.operator_id = u.id
        JOIN operators o ON u.id = o.user_id
        LEFT JOIN LATERAL (
            SELECT m.content_type
            FROM messages m
            WHERE m.chat_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
        ) last_m ON TRUE
        WHERE c.user_id = $1
          AND u.account_status = 'active'
          AND u.role = 'operator'
          AND u.gender = $2
          AND u.gender != 'coin_bayisi'
          AND COALESCE(last_m.content_type, 'text') NOT IN ('locked_image', 'locked_video')
        ORDER BY c.last_message_at DESC NULLS LAST
        LIMIT 1
    `, [userId, targetGender]);

    if (recentChatOpRes.rows.length > 0) {
        return recentChatOpRes.rows[0];
    }

    // 2. Fallback: Rastgele uygun operatör (son mesajı kilitli olmayan)
    const fallbackOpRes = await db.query(`
        SELECT u.id, u.username, COALESCE(u.display_name, u.name, u.username) AS display_name, u.avatar_url,
               c.id AS existing_chat_id
        FROM users u
        JOIN operators o ON u.id = o.user_id
        LEFT JOIN chats c ON c.user_id = $1 AND c.operator_id = u.id
        LEFT JOIN LATERAL (
            SELECT m.content_type
            FROM messages m
            WHERE m.chat_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
        ) last_m ON TRUE
        WHERE u.account_status = 'active'
          AND u.role = 'operator'
          AND u.gender = $2
          AND u.gender != 'coin_bayisi'
          AND COALESCE(last_m.content_type, 'text') NOT IN ('locked_image', 'locked_video')
        ORDER BY RANDOM()
        LIMIT 1
    `, [userId, targetGender]);

    return fallbackOpRes.rows[0] || null;
}

async function selectPhotoForUser(userId, forcePhotoId = null) {
    if (forcePhotoId) {
        const specific = await db.query(
            'SELECT * FROM locked_photo_pool WHERE id = $1 LIMIT 1',
            [forcePhotoId]
        );
        if (specific.rows.length > 0) return specific.rows[0];
    }

    const res = await db.query(`
        SELECT p.*
        FROM locked_photo_pool p
        WHERE p.is_active = TRUE
          AND NOT EXISTS (
              SELECT 1 FROM locked_photo_deliveries d
              WHERE d.photo_id = p.id AND d.user_id = $1
          )
        ORDER BY RANDOM()
        LIMIT 1
    `, [userId]);

    return res.rows[0] || null;
}

function pickPreMessage(photo, triggerType) {
    const custom = (photo?.pre_message || '').trim();
    if (custom) return custom;
    if (triggerType === 'evening_offline_push') {
        return OFFLINE_PUSH_PRE_MESSAGES[Math.floor(Math.random() * OFFLINE_PUSH_PRE_MESSAGES.length)];
    }
    return PRE_MESSAGE_POOL[Math.floor(Math.random() * PRE_MESSAGE_POOL.length)];
}

/**
 * Kullanıcıya önce doğal bir ön mesaj, 5–12 saniye sonra kilitli fotoğraf (varsayılan 100 coin) gönderir.
 */
async function deliverLockedPhotoToUser({
    io,
    userId,
    triggerType = 'evening_active',
    forcePhotoId = null,
    bypassChecks = false,
}) {
    if (!userId) return { sent: false, reason: 'missing_user_id' };
    const userIdStr = String(userId);
    if (inFlightUsers.has(userIdStr)) {
        return { sent: false, reason: 'in_flight' };
    }
    inFlightUsers.add(userIdStr);

    try {
        await ensureLockedPhotoPromoSchema();
        const settings = await getLockedPromoSettings();

        if (!bypassChecks && !settings.is_enabled) {
            return { sent: false, reason: 'disabled' };
        }

        const photo = await selectPhotoForUser(userId, forcePhotoId);
        if (!photo) {
            return { sent: false, reason: 'no_unseen_active_photo' };
        }

        let userRow;
        let operator;
        if (bypassChecks) {
            const uRes = await db.query(
                'SELECT id, username, display_name, gender, push_token FROM users WHERE id = $1',
                [userId]
            );
            userRow = uRes.rows[0];
            if (!userRow) return { sent: false, reason: 'user_not_found' };
            operator = await selectOperatorForLockedPhoto(userId, userRow.gender);
            if (!operator) return { sent: false, reason: 'no_eligible_operator' };
        } else {
            const preUserRes = await db.query(
                'SELECT id, gender FROM users WHERE id = $1',
                [userId]
            );
            if (preUserRes.rows.length === 0) return { sent: false, reason: 'user_not_found' };
            operator = await selectOperatorForLockedPhoto(userId, preUserRes.rows[0].gender);
            if (!operator) {
                return { sent: false, reason: 'no_eligible_operator' };
            }

            const dailyCap = Math.max(1, Number(settings.daily_cap || 1));
            const cooldownHours = Math.max(1, Number(settings.numara_cooldown_hours || 5));

            const claimRes = await db.query(`
                UPDATE users
                SET last_locked_promo_at = NOW()
                WHERE id = $1
                  AND role IN ('user', 'customer')
                  AND account_status = 'active'
                  AND onboarding_completed = TRUE
                  AND NOT EXISTS (
                      SELECT 1 FROM payments p
                      WHERE p.user_id::text = users.id::text
                        AND COALESCE(p.status, 'completed') IN ('completed', 'completed_vip')
                  )
                  AND (
                      last_locked_promo_at IS NULL
                      OR last_locked_promo_at < NOW() - INTERVAL '15 minutes'
                  )
                  AND (
                      SELECT COUNT(*)::int
                      FROM locked_photo_deliveries d
                      WHERE d.user_id = users.id
                        AND d.trigger_type != 'manual_test'
                        AND (d.created_at AT TIME ZONE '${TR_TZ}')::date = (NOW() AT TIME ZONE '${TR_TZ}')::date
                  ) < $2
                  AND (
                      ai_hook_sent_at IS NULL
                      OR ai_hook_sent_at < NOW() - ($3 || ' hours')::interval
                  )
                  AND NOT EXISTS (
                      SELECT 1
                      FROM messages m
                      JOIN chats c ON m.chat_id = c.id
                      WHERE c.user_id = users.id
                        AND m.content ILIKE '%NUMARA PAYLAŞIMI%'
                        AND m.created_at > NOW() - ($3 || ' hours')::interval
                  )
                RETURNING id, username, display_name, gender, push_token
            `, [userId, dailyCap, String(cooldownHours)]);

            if (claimRes.rows.length === 0) {
                return { sent: false, reason: 'not_eligible_or_capped' };
            }
            userRow = claimRes.rows[0];
        }

        let chatId = operator.existing_chat_id;
        if (!chatId) {
            const existingChat = await db.query(
                'SELECT id FROM chats WHERE (user_id = $1 AND operator_id = $2) OR (user_id = $2 AND operator_id = $1) LIMIT 1',
                [userId, operator.id]
            );
            if (existingChat.rows.length > 0) {
                chatId = existingChat.rows[0].id;
            } else {
                const createdChat = await db.query(
                    'INSERT INTO chats (user_id, operator_id, last_message_at) VALUES ($1, $2, NOW()) RETURNING id',
                    [userId, operator.id]
                );
                chatId = createdChat.rows[0].id;
            }
        }

        const opIdStr = String(operator.id);
        const chatIdStr = String(chatId);
        const opDisplayName = operator.display_name || operator.username || 'Fiora';
        const preMessageText = pickPreMessage(photo, triggerType);
        const unlockCost = Number(photo.unlock_cost || settings.default_unlock_cost || 100);

        // 1. Ön mesajı kaydet ve gönder
        const preMsgRes = await db.query(
            'INSERT INTO messages (chat_id, sender_id, content, content_type, is_read, created_at) VALUES ($1, $2, $3, $4, false, NOW()) RETURNING *',
            [chatId, operator.id, preMessageText, 'text']
        );
        const savedPreMsg = preMsgRes.rows[0];

        await db.query(
            'UPDATE chats SET last_message = $1, last_message_at = NOW() WHERE id = $2',
            [preMessageText, chatId]
        );

        const preMsgToEmit = {
            ...savedPreMsg,
            chat_id: chatIdStr,
            type: 'text',
            sender_id: opIdStr,
            sender_name: opDisplayName,
            sender_username: operator.username,
            sender_avatar: operator.avatar_url,
            created_at: savedPreMsg.created_at || new Date().toISOString(),
        };

        if (io) {
            io.to(chatIdStr).emit('receive_message', preMsgToEmit);
            io.to(userIdStr).emit('new_message', preMsgToEmit);
            io.to(userIdStr).emit('chat_updated', {
                chatId: chatIdStr,
                last_message: preMessageText,
                last_message_at: new Date(),
            });
            io.emit('admin_notification', preMsgToEmit);
        }

        // 2. 5 - 12 saniye arası doğal gecikme (yazıyor... efektiyle) ardından kilitli fotoğraf
        const delayMs = 5000 + Math.floor(Math.random() * 7001);

        const typingTimer = setTimeout(() => {
            if (io) {
                io.to(chatIdStr).emit('display_typing', {
                    userId: opIdStr,
                    chatId: chatIdStr,
                });
            }
        }, 1500);
        typingTimer.unref?.();

        const sendLockedStep = async () => {
            try {
                if (io) {
                    io.to(chatIdStr).emit('hide_typing', {
                        userId: opIdStr,
                        chatId: chatIdStr,
                    });
                }

                const lockedMsgRes = await db.query(
                    `INSERT INTO messages (chat_id, sender_id, content, content_type, unlock_cost, is_unlocked, is_read, created_at)
                     VALUES ($1, $2, $3, 'locked_image', $4, false, false, NOW())
                     RETURNING *`,
                    [chatId, operator.id, photo.image_url, unlockCost]
                );
                const savedLockedMsg = lockedMsgRes.rows[0];

                await db.query(
                    "UPDATE chats SET last_message = '🔒 Kilitli Resim', last_message_at = NOW() WHERE id = $1",
                    [chatId]
                );

                await db.query(
                    `INSERT INTO locked_photo_deliveries
                        (photo_id, user_id, operator_id, chat_id, pre_message_id, message_id, trigger_type, pre_message_text, unlock_cost)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [photo.id, userId, operator.id, chatId, savedPreMsg.id, savedLockedMsg.id, triggerType, preMessageText, unlockCost]
                );

                await db.query(
                    'UPDATE locked_photo_pool SET sent_count = sent_count + 1, updated_at = NOW() WHERE id = $1',
                    [photo.id]
                );

                const lockedMsgToEmit = {
                    ...savedLockedMsg,
                    chat_id: chatIdStr,
                    type: 'locked_image',
                    sender_id: opIdStr,
                    sender_name: opDisplayName,
                    sender_username: operator.username,
                    sender_avatar: operator.avatar_url,
                    created_at: savedLockedMsg.created_at || new Date().toISOString(),
                };

                if (io) {
                    io.to(chatIdStr).emit('receive_message', lockedMsgToEmit);
                    io.to(userIdStr).emit('new_message', lockedMsgToEmit);
                    io.to(userIdStr).emit('chat_updated', {
                        chatId: chatIdStr,
                        last_message: '🔒 Kilitli Resim',
                        last_message_at: new Date(),
                    });
                    io.emit('admin_notification', lockedMsgToEmit);
                }

                const isCurrentlyOnline = getActiveCustomerIds().includes(userIdStr);
                if (triggerType === 'evening_offline_push' || !isCurrentlyOnline) {
                    await sendPushNotification(userId, {
                        title: opDisplayName,
                        body: preMessageText,
                        data: {
                            chatId: chatIdStr,
                            senderId: opIdStr,
                            senderName: opDisplayName,
                            senderAvatar: operator.avatar_url,
                            type: 'message',
                        },
                    }).catch(() => {});
                }

                console.log(`[LOCKED_PROMO] (${triggerType}) [${opDisplayName} -> ${userRow.username}] Foto #${photo.id} (${unlockCost} coin) gönderildi.`);
            } catch (stepErr) {
                console.error('[LOCKED_PROMO] Kilitli fotoğraf adım hatası:', stepErr.message);
            }
        };

        const photoTimer = setTimeout(sendLockedStep, delayMs);
        photoTimer.unref?.();

        return {
            sent: true,
            photoId: photo.id,
            operatorId: operator.id,
            operatorName: opDisplayName,
            chatId,
            preMessageText,
            unlockCost,
            delayMs,
        };
    } catch (err) {
        console.error('[LOCKED_PROMO] deliverLockedPhotoToUser error:', err.message);
        return { sent: false, reason: 'error', error: err.message };
    } finally {
        inFlightUsers.delete(userIdStr);
    }
}

/**
 * Akşam saatlerinde (19:00–01:00 TR) kullanıcı uygulamaya bağlandığında 30–60 sn içinde tetiklenir.
 */
async function scheduleEveningActiveLockedPhoto({ io, userId }) {
    if (!userId) return;
    const userIdStr = String(userId);
    if (scheduledConnectUsers.has(userIdStr)) return;

    try {
        const settings = await getLockedPromoSettings();
        if (!settings.is_enabled) return;
        if (!isInEveningActiveWindow(settings)) return;

        scheduledConnectUsers.add(userIdStr);
        const delayMs = 30000 + Math.floor(Math.random() * 30000); // 30-60 saniye

        const timer = setTimeout(async () => {
            scheduledConnectUsers.delete(userIdStr);
            if (!getActiveCustomerIds().includes(userIdStr)) return;
            await deliverLockedPhotoToUser({
                io,
                userId,
                triggerType: 'evening_active',
            });
        }, delayMs);
        timer.unref?.();
    } catch (err) {
        scheduledConnectUsers.delete(userIdStr);
        console.error('[LOCKED_PROMO] scheduleEveningActiveLockedPhoto error:', err.message);
    }
}

/**
 * Periyodik sweeper:
 * 1) 19:00–01:00 arası aktif coin almayan kullanıcılara kilitli foto gönderir.
 * 2) 19:30–22:00 arası gündüz gelip akşam girmeyen/pasif coin almayanlara tek push + kilitli foto atar.
 */
async function runLockedPhotoPromoSweep(io) {
    try {
        const settings = await getLockedPromoSettings();
        if (!settings.is_enabled) {
            return { skipped: 'disabled', activeSent: 0, offlineSent: 0 };
        }

        const poolCheck = await db.query('SELECT COUNT(*)::int AS c FROM locked_photo_pool WHERE is_active = TRUE');
        if ((poolCheck.rows[0]?.c || 0) === 0) {
            return { skipped: 'empty_pool', activeSent: 0, offlineSent: 0 };
        }

        const clock = getIstanbulClock();
        let activeSent = 0;
        let offlineSent = 0;

        // 1. Akşam Aktif Coin Almayanlar (19:00–01:00)
        if (isInEveningActiveWindow(settings, clock)) {
            const activeIds = getActiveCustomerIds();
            for (const uid of activeIds) {
                if (scheduledConnectUsers.has(String(uid))) continue;
                const res = await deliverLockedPhotoToUser({
                    io,
                    userId: uid,
                    triggerType: 'evening_active',
                });
                if (res.sent) activeSent++;
            }
        }

        // 2. Akşam Pasif / Gündüz Gelip Girmeyenler (19:30–22:00)
        if (isInOfflinePushWindow(settings, clock)) {
            const minHours = Math.max(1, Number(settings.min_inactive_hours || 2));
            const maxDays = Math.max(1, Number(settings.max_inactive_days || 7));
            const dailyCap = Math.max(1, Number(settings.daily_cap || 1));
            const cooldownHours = Math.max(1, Number(settings.numara_cooldown_hours || 5));

            const offlineRes = await db.query(`
                SELECT u.id
                FROM users u
                WHERE u.role IN ('user', 'customer')
                  AND u.account_status = 'active'
                  AND u.onboarding_completed = TRUE
                  AND u.push_token IS NOT NULL
                  AND u.push_token != ''
                  AND COALESCE(u.last_login_at, u.created_at) < NOW() - ($1 || ' hours')::interval
                  AND COALESCE(u.last_login_at, u.created_at) > NOW() - ($2 || ' days')::interval
                  AND NOT EXISTS (
                      SELECT 1 FROM payments p
                      WHERE p.user_id::text = u.id::text
                        AND COALESCE(p.status, 'completed') IN ('completed', 'completed_vip')
                  )
                  AND (
                      SELECT COUNT(*)::int
                      FROM locked_photo_deliveries d
                      WHERE d.user_id = u.id
                        AND d.trigger_type != 'manual_test'
                        AND (d.created_at AT TIME ZONE '${TR_TZ}')::date = (NOW() AT TIME ZONE '${TR_TZ}')::date
                  ) < $3
                  AND (
                      u.ai_hook_sent_at IS NULL
                      OR u.ai_hook_sent_at < NOW() - ($4 || ' hours')::interval
                  )
                  AND NOT EXISTS (
                      SELECT 1
                      FROM messages m
                      JOIN chats c ON m.chat_id = c.id
                      WHERE c.user_id = u.id
                        AND m.content ILIKE '%NUMARA PAYLAŞIMI%'
                        AND m.created_at > NOW() - ($4 || ' hours')::interval
                  )
                  AND EXISTS (
                      SELECT 1 FROM locked_photo_pool lp
                      WHERE lp.is_active = TRUE
                        AND NOT EXISTS (
                            SELECT 1 FROM locked_photo_deliveries ld
                            WHERE ld.photo_id = lp.id AND ld.user_id = u.id
                        )
                  )
                ORDER BY COALESCE(u.last_login_at, u.created_at) DESC
                LIMIT 20
            `, [String(minHours), String(maxDays), dailyCap, String(cooldownHours)]);

            const onlineSet = new Set(getActiveCustomerIds().map(String));
            for (const row of offlineRes.rows) {
                if (onlineSet.has(String(row.id))) continue;
                const res = await deliverLockedPhotoToUser({
                    io,
                    userId: row.id,
                    triggerType: 'evening_offline_push',
                });
                if (res.sent) offlineSent++;
            }
        }

        return { activeSent, offlineSent };
    } catch (err) {
        console.error('[LOCKED_PROMO] Sweeper error:', err.message);
        return { activeSent: 0, offlineSent: 0, error: err.message };
    }
}

let promoSweeperStarted = false;
function startLockedPhotoPromoSweeper(io) {
    if (promoSweeperStarted) return;
    promoSweeperStarted = true;

    ensureLockedPhotoPromoSchema().catch((err) => {
        console.error('[LOCKED_PROMO] Initial schema init error:', err.message);
    });

    const interval = setInterval(() => {
        runLockedPhotoPromoSweep(io).catch(() => {});
    }, 5 * 60 * 1000);
    interval.unref?.();

    const bootTimer = setTimeout(() => {
        runLockedPhotoPromoSweep(io).catch(() => {});
    }, 20000);
    bootTimer.unref?.();
}

async function recordLockedPhotoInsufficientHit(messageId) {
    if (!messageId) return;
    try {
        await ensureLockedPhotoPromoSchema();
        const res = await db.query(`
            UPDATE locked_photo_deliveries
            SET insufficient_funds_hit_at = NOW()
            WHERE message_id::text = $1::text
              AND insufficient_funds_hit_at IS NULL
            RETURNING photo_id
        `, [String(messageId)]);

        if (res.rows.length > 0) {
            await db.query(
                'UPDATE locked_photo_pool SET insufficient_hits = insufficient_hits + 1, updated_at = NOW() WHERE id = $1',
                [res.rows[0].photo_id]
            );
        }
    } catch (err) {
        console.warn('[LOCKED_PROMO] recordLockedPhotoInsufficientHit warn:', err.message);
    }
}

async function recordLockedPhotoUnlock(messageId) {
    if (!messageId) return;
    try {
        await ensureLockedPhotoPromoSchema();
        const res = await db.query(`
            UPDATE locked_photo_deliveries
            SET is_unlocked = TRUE,
                unlocked_at = NOW()
            WHERE message_id::text = $1::text
              AND is_unlocked = FALSE
            RETURNING photo_id
        `, [String(messageId)]);

        if (res.rows.length > 0) {
            await db.query(
                'UPDATE locked_photo_pool SET unlock_count = unlock_count + 1, updated_at = NOW() WHERE id = $1',
                [res.rows[0].photo_id]
            );
        }
    } catch (err) {
        console.warn('[LOCKED_PROMO] recordLockedPhotoUnlock warn:', err.message);
    }
}

async function recordLockedPhotoPurchaseConversion({ userId, paymentId = null, amount = 0 }) {
    if (!userId) return;
    try {
        await ensureLockedPhotoPromoSchema();
        const numericAmount = parseFloat(amount) || 0;

        // Son 48 saat içinde gönderilmiş (öncelikle bakiye yetersiz tıklaması almış) kilitli foto teslimatına yaz
        const targetRes = await db.query(`
            SELECT id, photo_id
            FROM locked_photo_deliveries
            WHERE user_id::text = $1::text
              AND converted_to_purchase = FALSE
              AND created_at > NOW() - INTERVAL '48 hours'
            ORDER BY (insufficient_funds_hit_at IS NOT NULL) DESC, created_at DESC
            LIMIT 1
        `, [String(userId)]);

        if (targetRes.rows.length === 0) return;

        const delivery = targetRes.rows[0];
        const upd = await db.query(`
            UPDATE locked_photo_deliveries
            SET converted_to_purchase = TRUE,
                converted_payment_id = $2,
                converted_amount = $3,
                converted_at = NOW()
            WHERE id = $1
              AND converted_to_purchase = FALSE
            RETURNING photo_id
        `, [delivery.id, paymentId ? String(paymentId) : null, numericAmount]);

        if (upd.rows.length > 0) {
            await db.query(`
                UPDATE locked_photo_pool
                SET purchase_conversion_count = purchase_conversion_count + 1,
                    conversion_revenue = conversion_revenue + $2,
                    updated_at = NOW()
                WHERE id = $1
            `, [upd.rows[0].photo_id, numericAmount]);
        }
    } catch (err) {
        console.warn('[LOCKED_PROMO] recordLockedPhotoPurchaseConversion warn:', err.message);
    }
}

module.exports = {
    TR_TZ,
    PRE_MESSAGE_POOL,
    OFFLINE_PUSH_PRE_MESSAGES,
    ensureLockedPhotoPromoSchema,
    getIstanbulClock,
    isInEveningActiveWindow,
    isInOfflinePushWindow,
    getLockedPromoSettings,
    deliverLockedPhotoToUser,
    scheduleEveningActiveLockedPhoto,
    runLockedPhotoPromoSweep,
    startLockedPhotoPromoSweeper,
    recordLockedPhotoInsufficientHit,
    recordLockedPhotoUnlock,
    recordLockedPhotoPurchaseConversion,
};
