const db = require('../db');

const sanitizeUser = (user, req) => {
    if (!user) return null;
    // Force HTTPS on Render or if x-forwarded-proto is https
    let protocol = 'http';
    if (req.get && (req.get('host').includes('onrender.com') || req.headers['x-forwarded-proto'] === 'https')) {
        protocol = 'https';
    } else {
        protocol = req?.protocol || 'http';
    }
    const host = (req?.get ? req.get('host') : null) || 'localhost:3000';

    const newUser = { ...user };

    const rewrite = (url) => {
        if (url && typeof url === 'string' && !url.startsWith('http')) {
            return `${protocol}://${host}${url.startsWith('/') ? '' : '/'}${url}`;
        }
        return url;
    };

    // Rewrite common image fields
    if (newUser.avatar_url) newUser.avatar_url = rewrite(newUser.avatar_url);
    if (newUser.avatar) newUser.avatar = rewrite(newUser.avatar);
    if (newUser.image_url) newUser.image_url = rewrite(newUser.image_url);
    if (newUser.image) newUser.image = rewrite(newUser.image);

    // Pass through onboarding status
    if (user.onboarding_completed !== undefined) {
        newUser.onboarding_completed = !!user.onboarding_completed;
    }

    // Rewrite Photos array if exists (for operators)
    if (newUser.photos && Array.isArray(newUser.photos)) {
        newUser.photos = newUser.photos.map(p => rewrite(p));
    }

    return newUser;
};

// Helper: Log Activity & Emit Socket Event
const logActivity = async (io, userId, actionType, description) => {
    try {
        // 1. Insert into DB
        const result = await db.query(
            'INSERT INTO activities (user_id, action_type, description) VALUES ($1, $2, $3) RETURNING *',
            [userId, actionType, description]
        );

        // 2. Fetch User Details for UI
        const act = result.rows[0];
        const userRes = await db.query('SELECT username, avatar_url FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0] || { username: 'Unknown', avatar_url: '' };

        const fullActivity = { ...act, user_name: user.username, user_avatar: user.avatar_url };

        // 3. Emit Real-time Event if io is provided
        if (io) {
            io.emit('new_activity', fullActivity);
        }

        return fullActivity;
    } catch (err) {
        console.error("Log Activity Error:", err.message);
    }
};

// Add fake social interactions for new users (Favorites and Views)
const assignFakeInteractions = async (newUserId) => {
    try {
        // Find some random active users to act as fake admirers/viewers (min 3, max 8)
        const limitCount = Math.floor(Math.random() * 6) + 3;
        const randomUsers = await db.query(
            "SELECT id FROM users WHERE id != $1 AND account_status = 'active' ORDER BY RANDOM() LIMIT $2",
            [newUserId, limitCount]
        );

        if (randomUsers.rows.length === 0) return;

        const fakeUsers = randomUsers.rows;

        for (let i = 0; i < fakeUsers.length; i++) {
            const actorId = fakeUsers[i].id;

            // 60% chance for favorite
            if (Math.random() > 0.4) {
                await db.query(
                    'INSERT INTO favorites (user_id, target_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [actorId, newUserId]
                );
            }

            // 80% chance for profile view
            if (Math.random() > 0.2) {
                // Insert with a random past timestamp between now and 24 hours ago
                const randomSeconds = Math.floor(Math.random() * 86400);
                await db.query(
                    `INSERT INTO profile_views (viewer_id, viewed_user_id, created_at) 
                     VALUES ($1, $2, NOW() - INTERVAL '${randomSeconds} seconds')`,
                    [actorId, newUserId]
                );
            }
        }
    } catch (err) {
        console.error("Fake Interaction Error:", err.message);
    }
};

// Auto-Engagement: Send messages from operators to new users over time
const triggerAutoEngagement = async (io, newUserId) => {
    try {
        console.log(`[AUTO-ENGAGEMENT] Triggered for user: ${newUserId}`);

        // 1. Find 3 random operators
        const opsRes = await db.query(
            "SELECT u.id, u.username FROM users u JOIN operators o ON u.id = o.user_id WHERE u.account_status = 'active' ORDER BY RANDOM() LIMIT 3"
        );

        if (opsRes.rows.length === 0) {
            console.log("[AUTO-ENGAGEMENT] No operators found to send messages.");
            return;
        }

        const operators = opsRes.rows;
        const messages = [
            "Selam, yeni misin buralarda? 😊",
            "Merhaba, profilin çok hoşuma gitti, tanışabilir miyiz?",
            "Hey! Sesin olsa nasıl olurdu merak ettim, burası çok eğlenceli!",
            "Günün nasıl geçiyor? Seninle sohbet etmek isterim.",
            "Selamlar! Profilini gördüm ve kayıtsız kalamadım ✨",
            "Hoş geldin! Aradığın birisi var mı yoksa sadece takılıyor musun? :)"
        ];

        // Schedule 3 messages
        const schedule = [
            { delay: 90 * 1000, op: operators[0], msg: messages[Math.floor(Math.random() * 2)] }, // ~1.5m
            { delay: 270 * 1000, op: operators[1] || operators[0], msg: messages[Math.floor(Math.random() * 2) + 2] }, // ~4.5m
            { delay: 480 * 1000, op: operators[2] || operators[0], msg: messages[Math.floor(Math.random() * 2) + 4] } // ~8m
        ];

        schedule.forEach(item => {
            setTimeout(async () => {
                try {
                    // Check if chat exists or create it
                    let chatRes = await db.query(
                        'SELECT id FROM chats WHERE (user_id = $1 AND operator_id = $2) OR (user_id = $2 AND operator_id = $1)',
                        [newUserId, item.op.id]
                    );

                    let chatId;
                    if (chatRes.rows.length === 0) {
                        const newChat = await db.query(
                            'INSERT INTO chats (user_id, operator_id, last_message, last_message_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
                            [newUserId, item.op.id, item.msg]
                        );
                        chatId = newChat.rows[0].id;
                    } else {
                        chatId = chatRes.rows[0].id;
                    }

                    // Insert message
                    const msgResult = await db.query(
                        'INSERT INTO messages (chat_id, sender_id, content, content_type) VALUES ($1, $2, $3, $4) RETURNING *',
                        [chatId, item.op.id, item.msg, 'text']
                    );
                    const savedMsg = msgResult.rows[0];

                    // Update last message in chat
                    await db.query('UPDATE chats SET last_message = $1, last_message_at = NOW() WHERE id = $2', [item.msg, chatId]);

                    // Emit to user via socket
                    if (io) {
                        const roomName = chatId.toString();
                        const msgToEmit = {
                            ...savedMsg,
                            chat_id: roomName,
                            sender_username: item.op.username
                        };

                        console.log(`[AUTO-MESSAGE] Sending to ${newUserId} from ${item.op.username}`);
                        // Emit to the specific chat room
                        io.to(roomName).emit('receive_message', msgToEmit);
                        // Emit to global admin feed
                        io.emit('admin_notification', msgToEmit);
                    }

                } catch (err) {
                    console.error("[AUTO-ENGAGEMENT ERROR] Failed to send scheduled message:", err.message);
                }
            }, item.delay);
        });

    } catch (err) {
        console.error("[AUTO-ENGAGEMENT ERROR]:", err.message);
    }
};

module.exports = {
    sanitizeUser,
    logActivity,
    assignFakeInteractions,
    triggerAutoEngagement
};
