const { Expo } = require('expo-server-sdk');
const db = require('../db');

// Create a new Expo SDK client
let expo = new Expo();

/**
 * Sends a push notification to a specific user
 * @param {string} userId - The ID of the recipient user
 * @param {object} notificationContent - { title, body, data }
 */
const sendPushNotification = async (userId, { title, body, data }) => {
    try {
        // 1. Get user's push token from DB
        const res = await db.query('SELECT push_token FROM users WHERE id = $1', [userId]);
        const pushToken = res.rows[0]?.push_token;

        if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
            // console.warn(`[NOTIFY] User ${userId} has no valid push token.`);
            return;
        }

        // 2. Construct the message
        const messages = [{
            to: pushToken,
            sound: 'default',
            title: title,
            body: body,
            data: data || {},
        }];

        // 3. Send the notification
        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];

        for (let chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error('[NOTIFY ERROR] Chunk send error:', error);
            }
        }

        // Note: In production, you should handle tickets to check for errors/receipts
        // console.log(`[NOTIFY SUCCESS] Sent to user ${userId}`);
    } catch (err) {
        console.error('[NOTIFY ERROR] Critical error:', err.message);
    }
};

module.exports = {
    sendPushNotification
};
