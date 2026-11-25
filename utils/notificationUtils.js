const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');
const { Expo } = require('expo-server-sdk');
const db = require('../db');

const expo = new Expo();
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

let cachedServiceAccount = undefined;
let cachedGoogleAuth = null;

/**
 * Loads Firebase Service Account credentials from env vars or gitignored local JSON file.
 */
function loadFirebaseServiceAccount() {
    if (cachedServiceAccount !== undefined) {
        return cachedServiceAccount;
    }

    const rawJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
    if (rawJson) {
        try {
            const parsed = JSON.parse(rawJson);
            if (parsed.project_id && parsed.client_email && parsed.private_key) {
                cachedServiceAccount = {
                    ...parsed,
                    private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
                };
                return cachedServiceAccount;
            }
        } catch (err) {
            console.error('[NOTIFY ERROR] Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
        }
    }

    const envProjectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
    const envClientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
    const envPrivateKey = (process.env.FIREBASE_PRIVATE_KEY || '').trim();
    if (envProjectId && envClientEmail && envPrivateKey) {
        cachedServiceAccount = {
            project_id: envProjectId,
            client_email: envClientEmail,
            private_key: envPrivateKey.replace(/\\n/g, '\n'),
        };
        return cachedServiceAccount;
    }

    const candidatePaths = [
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
        path.join(__dirname, '../firebase-service-account.json'),
    ].filter(Boolean);

    for (const filePath of candidatePaths) {
        try {
            if (fs.existsSync(filePath)) {
                const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (parsed.project_id && parsed.client_email && parsed.private_key) {
                    cachedServiceAccount = {
                        ...parsed,
                        private_key: String(parsed.private_key).replace(/\\n/g, '\n'),
                    };
                    return cachedServiceAccount;
                }
            }
        } catch (err) {
            console.error('[NOTIFY ERROR] Failed reading Firebase JSON file:', err.message);
        }
    }

    cachedServiceAccount = null;
    return null;
}

/**
 * Acquires an OAuth2 Bearer access token for Firebase Cloud Messaging HTTP v1 API.
 */
async function getFcmAccessToken(serviceAccount) {
    if (!cachedGoogleAuth) {
        cachedGoogleAuth = new GoogleAuth({
            credentials: {
                client_email: serviceAccount.client_email,
                private_key: serviceAccount.private_key,
            },
            scopes: [FCM_SCOPE],
        });
    }
    const client = await cachedGoogleAuth.getClient();
    const tokenResponse = await client.getAccessToken();
    return typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
}

/**
 * Serializes notification payload data values to strings as required by FCM HTTP v1.
 */
function sanitizeFcmData(data) {
    const clean = {};
    if (!data || typeof data !== 'object') return clean;
    for (const [key, val] of Object.entries(data)) {
        if (val !== undefined && val !== null) {
            clean[String(key)] = typeof val === 'string' ? val : String(val);
        }
    }
    return clean;
}

/**
 * Sends a notification directly via Firebase Cloud Messaging HTTP v1 API using a raw FCM device token.
 */
async function sendDirectFcmNotification(userId, fcmToken, { title, body, data, channelId = 'default' }) {
    const serviceAccount = loadFirebaseServiceAccount();
    if (!serviceAccount) {
        console.error('[NOTIFY ERROR] Firebase service account credentials missing for direct FCM push.');
        return { sent: false, reason: 'missing_firebase_credentials' };
    }

    try {
        const accessToken = await getFcmAccessToken(serviceAccount);
        if (!accessToken) {
            return { sent: false, reason: 'fcm_access_token_unavailable' };
        }

        const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(serviceAccount.project_id)}/messages:send`;
        const payload = {
            message: {
                token: fcmToken,
                notification: {
                    title: String(title || ''),
                    body: String(body || ''),
                },
                android: {
                    priority: 'HIGH',
                    ttl: '86400s',
                    notification: {
                        channel_id: String(channelId || 'default'),
                        sound: 'default',
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                        },
                    },
                },
                data: sanitizeFcmData(data),
            },
        };

        const response = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            timeout: 8000,
        });

        return { sent: true, provider: 'fcm_v1', messageName: response.data?.name };
    } catch (err) {
        const errData = err.response?.data?.error;
        const details = Array.isArray(errData?.details) ? errData.details : [];
        const fcmErrorCode = details.find((d) => d.errorCode)?.errorCode || errData?.status;

        console.error(`[NOTIFY ERROR] FCM v1 error for user ${userId}:`, errData?.message || err.message, fcmErrorCode || '');

        if (fcmErrorCode === 'UNREGISTERED' || fcmErrorCode === 'NOT_FOUND') {
            await db.query('UPDATE users SET push_token = NULL WHERE id::text = $1::text', [String(userId)]).catch(() => {});
            console.log(`[NOTIFY] Cleared unregistered FCM token for user ${userId}`);
        }

        return { sent: false, provider: 'fcm_v1', error: errData?.message || err.message, errorCode: fcmErrorCode };
    }
}

/**
 * Sends a push notification to a user.
 * Uses direct Firebase FCM HTTP v1 for native device tokens and Expo Push Service for legacy ExpoPushToken values.
 */
const sendPushNotification = async (userId, { title, body, data, channelId = 'default' }) => {
    try {
        const res = await db.query('SELECT push_token FROM users WHERE id::text = $1::text', [String(userId)]);
        const pushToken = res.rows[0]?.push_token;

        if (!pushToken || typeof pushToken !== 'string' || !pushToken.trim()) {
            return { sent: false, reason: 'invalid_or_missing_token' };
        }

        const cleanToken = pushToken.trim();

        // Direct FCM token (Android/iOS native device token, does not require Expo servers)
        if (!Expo.isExpoPushToken(cleanToken)) {
            return sendDirectFcmNotification(userId, cleanToken, { title, body, data, channelId });
        }

        // Legacy ExpoPushToken path (for older builds still emitting ExponentPushToken[...])
        const messages = [{
            to: cleanToken,
            sound: 'default',
            title,
            body,
            data: data || {},
            channelId,
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
                    await db.query('UPDATE users SET push_token = NULL WHERE id::text = $1::text', [String(userId)]).catch(() => {});
                    console.log(`[NOTIFY] Cleared unregistered push_token for user ${userId}`);
                }
            }
        }

        return { sent: tickets.some((t) => t.status === 'ok'), provider: 'expo', tickets };
    } catch (err) {
        console.error('[NOTIFY ERROR] Critical error:', err.message);
        return { sent: false, error: err.message };
    }
};

module.exports = {
    sendPushNotification,
    sendDirectFcmNotification,
    loadFirebaseServiceAccount,
    getFcmAccessToken,
};
