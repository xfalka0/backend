
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
    if (cost <= 0) return;

    // 1. Find the operator for this chat
    const chatRes = await client.query('SELECT operator_id FROM chats WHERE id = $1', [chatId]);
    if (chatRes.rows.length === 0) return;
    
    const operatorId = chatRes.rows[0].operator_id;
    if (!operatorId) return;

    // 1.5 Find who manages this avatar (to pay the actual human)
    const managerRes = await client.query('SELECT managed_by, role FROM users WHERE id::text = $1::text', [operatorId]);
    const avatarData = managerRes.rows[0] || {};
    
    // Check if the sender is a staff/moderator/admin/operator
    let isSenderStaff = false;
    let senderRole = 'user';
    
    if (senderId && senderId !== '00000000-0000-0000-0000-000000000000') {
        const senderRes = await client.query('SELECT role FROM users WHERE id::text = $1::text', [senderId]);
        senderRole = senderRes.rows.length > 0 ? senderRes.rows[0].role : 'user';
        isSenderStaff = ['staff', 'moderator', 'admin', 'super_admin', 'operator'].includes(senderRole);
    }

    // PAYEE LOGIC: 
    let actualPayeeId = operatorId;
    if (isSenderStaff) {
        actualPayeeId = senderId;
    } else if (avatarData.managed_by) {
        actualPayeeId = avatarData.managed_by;
    }

    // 1.6 Activity Tracking
    await client.query('UPDATE operators SET last_active_at = NOW() WHERE user_id = $1', [actualPayeeId]);

    // 2. Bonus Protection Check - CHECK THE CUSTOMER (user_id in chat), NOT THE SENDER (staff)
    const chatUserRes = await client.query('SELECT user_id FROM chats WHERE id = $1', [chatId]);
    const customerId = chatUserRes.rows.length > 0 ? chatUserRes.rows[0].user_id : null;
    
    const userCheck = await client.query('SELECT total_spent FROM users WHERE id = $1', [customerId]);
    const userLifetimeSpent = userCheck.rows.length > 0 ? parseFloat(userCheck.rows[0].total_spent || 0) : 0;
    
    let rate = 0.25; 
    if (type === 'text') rate = 0.115; 
    else if (type === 'image') rate = 1.0; 
    else if (type === 'audio') rate = 0.5; 
    else if (type === 'gift') rate = 0.25;
    
    // If customer has never spent money, use bonus rate
    if (userLifetimeSpent <= 0 && customerId) {
        const adminAddCheck = await client.query(
            "SELECT id FROM transactions WHERE user_id = $1 AND (type = 'admin_add' OR type = 'admin_edit' OR type = 'purchase') LIMIT 1", 
            [customerId]
        );
        if (adminAddCheck.rows.length === 0) {
            rate = 0.05; 
        }
    }
    
    const earned = cost * rate;
    if (earned <= 0 && cost > 0) return;

    // 3. Update PAYEE balance
    await client.query(
        `UPDATE operators SET 
            pending_balance = COALESCE(pending_balance, 0) + $1, 
            lifetime_earnings = COALESCE(lifetime_earnings, 0) + $1 
         WHERE user_id = $2`,
        [earned, actualPayeeId]
    );

    // 3.5 Detailed Log for tracking
    try {
        if (chatId && actualPayeeId) {
            await client.query(
                'INSERT INTO commission_logs (operator_id, chat_id, amount, type) VALUES ($1, $2, $3, $4)',
                [actualPayeeId, chatId, earned, type]
            );
        }
    } catch (logErr) {
        console.error('[COMMISSION-LOG-ERROR] Failed to write detailed log:', logErr.message);
        // We don't block the message if log fails, but we want to know why
    }

    // 4. Update Daily Stats for PAYEE (Upsert)
    await client.query(`
        INSERT INTO operator_stats (
            operator_id, date, 
            messages_sent, coins_earned, total_user_spend,
            text_count, image_count, audio_count, gift_count,
            text_earned, image_earned, audio_earned, gift_earned
        )
        VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (operator_id, date) DO UPDATE SET
            messages_sent = COALESCE(operator_stats.messages_sent, 0) + EXCLUDED.messages_sent,
            coins_earned = COALESCE(operator_stats.coins_earned, 0) + EXCLUDED.coins_earned,
            total_user_spend = COALESCE(operator_stats.total_user_spend, 0) + EXCLUDED.total_user_spend,
            text_count = COALESCE(operator_stats.text_count, 0) + EXCLUDED.text_count,
            image_count = COALESCE(operator_stats.image_count, 0) + EXCLUDED.image_count,
            audio_count = COALESCE(operator_stats.audio_count, 0) + EXCLUDED.audio_count,
            gift_count = COALESCE(operator_stats.gift_count, 0) + EXCLUDED.gift_count,
            text_earned = COALESCE(operator_stats.text_earned, 0) + EXCLUDED.text_earned,
            image_earned = COALESCE(operator_stats.image_earned, 0) + EXCLUDED.image_earned,
            audio_earned = COALESCE(operator_stats.audio_earned, 0) + EXCLUDED.audio_earned,
            gift_earned = COALESCE(operator_stats.gift_earned, 0) + EXCLUDED.gift_earned
    `, [
        actualPayeeId, 
        type === 'text' ? 1 : 0, 
        earned, 
        cost,
        type === 'text' ? 1 : 0,
        type === 'image' ? 1 : 0,
        type === 'audio' ? 1 : 0,
        type === 'gift' ? 1 : 0,
        type === 'text' ? earned : 0,
        type === 'image' ? earned : 0,
        type === 'audio' ? earned : 0,
        type === 'gift' ? earned : 0
    ]);
}

module.exports = { recordOperatorCommission };
