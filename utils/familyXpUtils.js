const db = require('../db');
const familyRoutes = require('../routes/family');

/**
 * Handles awarding family XP for gift sending and receiving
 * @param {object} client - Database client (for transaction safety)
 * @param {string} senderId - UUID of the user sending the gift
 * @param {string} receiverId - UUID of the user receiving the gift
 * @param {number} giftValue - Coin cost of the gift
 */
async function handleGiftFamilyXp(client, senderId, receiverId, giftValue) {
    try {
        // 1. Sender Family XP (giftValue * 1)
        if (senderId) {
            const senderFam = await client.query('SELECT family_id FROM family_members WHERE user_id = $1', [senderId]);
            if (senderFam && senderFam.rows && senderFam.rows.length > 0) {
                const familyId = senderFam.rows[0].family_id;
                const xpToSend = Math.max(1, Math.round(giftValue * 1.0));
                await familyRoutes.awardFamilyXp(client, familyId, senderId, xpToSend, 'gift_sent');
            }
        }

        // 2. Receiver Family XP (giftValue * 0.5)
        if (receiverId) {
            const receiverFam = await client.query('SELECT family_id FROM family_members WHERE user_id = $1', [receiverId]);
            if (receiverFam && receiverFam.rows && receiverFam.rows.length > 0) {
                const familyId = receiverFam.rows[0].family_id;
                const xpToRecv = Math.max(1, Math.round(giftValue * 0.5));
                await familyRoutes.awardFamilyXp(client, familyId, receiverId, xpToRecv, 'gift_received');
            }
        }
    } catch (err) {
        console.error('[handleGiftFamilyXp] Error awarding family XP from gift:', err.message);
    }
}

async function trackUserVoiceTime(client, userId, additionalSeconds) {
    if (additionalSeconds <= 0) return;
    try {
        // Find if user is in a family
        const memberRes = await client.query('SELECT family_id FROM family_members WHERE user_id = $1', [userId]);
        if (!memberRes || !memberRes.rows || memberRes.rows.length === 0) return; // Not in a family, no XP to award
        const familyId = memberRes.rows[0].family_id;

        // Upsert daily record
        const selectRes = await client.query(`
            INSERT INTO user_daily_voice_time (user_id, date, duration_seconds, xp_stage)
            VALUES ($1, CURRENT_DATE, $2, 0)
            ON CONFLICT (user_id, date) DO UPDATE 
            SET duration_seconds = user_daily_voice_time.duration_seconds + $2
            RETURNING duration_seconds, xp_stage
        `, [userId, additionalSeconds]);

        if (!selectRes || !selectRes.rows || selectRes.rows.length === 0) return;
        const { duration_seconds: totalSeconds, xp_stage: currentStage } = selectRes.rows[0];

        // Stage 1: 15 mins (900 seconds) -> +20 XP
        if (totalSeconds >= 900 && currentStage < 1) {
            await client.query(`
                UPDATE user_daily_voice_time 
                SET xp_stage = 1 
                WHERE user_id = $1 AND date = CURRENT_DATE
            `, [userId]);
            await familyRoutes.awardFamilyXp(client, familyId, userId, 20, 'voice_room');
        }

        // Stage 2: 60 mins (3600 seconds) -> +60 XP
        if (totalSeconds >= 3600 && currentStage < 2) {
            await client.query(`
                UPDATE user_daily_voice_time 
                SET xp_stage = 2 
                WHERE user_id = $1 AND date = CURRENT_DATE
            `, [userId]);
            await familyRoutes.awardFamilyXp(client, familyId, userId, 60, 'voice_room');
        }
    } catch (err) {
        console.error('[trackUserVoiceTime] Error tracking voice stay:', err.message);
    }
}

module.exports = {
    handleGiftFamilyXp,
    trackUserVoiceTime
};
