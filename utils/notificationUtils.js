const { Expo } = require('expo-server-sdk');
const db = require('../db');

// Create a new Expo SDK client
const expo = new Expo();

/**
 * Sends a push notification to a specific user via Expo Push Service.
 * Ensures Android high-priority default channel and cleans up unregistered tokens.
 * @param {string} userId - The ID of the recipient user
 * @param {object} notificationContent - { title, body, data, channelId }
 */
const sendPushNotification = async (userId, { title, body, data, channelId = 'default' }) => {
    try {
        const res = await db.query('SELECT push_token FROM users WHERE id = $1', [userId]);
        const pushToken = res.rows[0]?.push_token;

        if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
            return { sent: false, reason: 'invalid_or_missing_token' };
        }

        const messages = [{
            to: pushToken,
            sound: 'default',
            title: title,
            body: body,
            data: data || {},
            channelId: channelId,
            priority: 'high',
            ttl: 86400
        }];

        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error('[NOTIFY ERROR] Chunk send error:', error.message);
            }
        }

        for (const ticket of tickets) {
            if (ticket.status === 'error') {
                console.error(`[NOTIFY ERROR] Expo ticket error for user ${userId}: ${ticket.message}`, ticket.details || '');
                if (ticket.details?.error === 'DeviceNotRegistered') {
                    await db.query('UPDATE users SET push_token = NULL WHERE id = $1', [userId]).catch(() => {});
                    console.log(`[NOTIFY] Cleared unregistered push_token for user ${userId}`);
                }
            }
        }

        return { sent: tickets.some(t => t.status === 'ok'), tickets };
    } catch (err) {
        console.error('[NOTIFY ERROR] Critical error:', err.message);
        return { sent: false, error: err.message };
    }
};

module.exports = {
    sendPushNotification
};
