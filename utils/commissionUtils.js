
const db = require('../db');

/**
 * Calculates and records commission for an operator when a user spends coins.
 * @param {object} client - PG Client for transaction safety
 * @param {string} chatId - ID of the chat where activity happened
 * @param {string} senderId - ID of the user who spent coins
 * @param {number} cost - Total coins spent by user
 * @param {string} type - Action type ('text', 'image', 'gift', etc.)
 */
async function recordOperatorCommission(client, chatId, senderId, cost, type) {
    if (cost <= 0) {
        console.log(`[PAYOUT] Skipping for zero cost message in chat: ${chatId}`);
        return;
    }

    console.log(`[PAYOUT] STARTING: chat=${chatId}, sender=${senderId}, cost=${cost}, type=${type}`);
    // 1. Find the operator for this chat
    const chatRes = await client.query('SELECT operator_id FROM chats WHERE id = $1', [chatId]);
    if (chatRes.rows.length === 0) {
        console.log(`[PAYOUT] Chat ${chatId} not found`);
        return;
    }
    
    const operatorId = chatRes.rows[0].operator_id;
    if (!operatorId) {
        console.log(`[PAYOUT] No operator assigned to chat ${chatId}`);
        return;
    }

    // 1.5 Find who manages this avatar (to pay the actual human)
    const managerRes = await client.query('SELECT managed_by FROM users WHERE id = $1', [operatorId]);
    const actualPayeeId = (managerRes.rows.length > 0 && managerRes.rows[0].managed_by) 
        ? managerRes.rows[0].managed_by 
        : operatorId;

    console.log(`[PAYOUT] Payee determined: ${actualPayeeId}`);

    // 1.6 Activity Tracking
    await client.query('UPDATE operators SET last_active_at = NOW() WHERE user_id = $1', [actualPayeeId]);

    // 2. Bonus Protection Check
    const userCheck = await client.query('SELECT total_spent FROM users WHERE id = $1', [senderId]);
    const userLifetimeSpent = userCheck.rows.length > 0 ? parseFloat(userCheck.rows[0].total_spent || 0) : 0;
    
    let commissionType = 'REAL';
    let rate = 0.25; 
    
    if (type === 'text') rate = 0.23;
    else if (type === 'image') rate = 0.40;
    else if (type === 'audio') rate = 0.3333333333333333;
    else if (type === 'gift') rate = 0.25;
    
    if (userLifetimeSpent <= 0) {
        rate = 0.05; 
        commissionType = 'BONUS';
    }

    const earned = cost * rate;
    console.log(`[PAYOUT] Earned: ${earned}, Rate: ${rate}`);

    if (earned <= 0 && cost > 0 && commissionType === 'REAL') return;

    // 3. Update PAYEE balance
    await client.query(
        `UPDATE operators SET 
            pending_balance = COALESCE(pending_balance, 0) + $1, 
            lifetime_earnings = COALESCE(lifetime_earnings, 0) + $1 
         WHERE user_id = $2`,
        [earned, actualPayeeId]
    );

    // 4. Update Daily Stats for PAYEE (Upsert)
    await client.query(`
        INSERT INTO operator_stats (operator_id, date, messages_sent, coins_earned, total_user_spend)
        VALUES ($1, CURRENT_DATE, $2, $3, $4)
        ON CONFLICT (operator_id, date) DO UPDATE SET
            messages_sent = operator_stats.messages_sent + EXCLUDED.messages_sent,
            coins_earned = operator_stats.coins_earned + EXCLUDED.coins_earned,
            total_user_spend = operator_stats.total_user_spend + EXCLUDED.total_user_spend
    `, [actualPayeeId, type === 'text' ? 1 : 0, earned, cost]);
    
    console.log(`[PAYOUT] Success for ${actualPayeeId}`);
}

module.exports = { recordOperatorCommission };
