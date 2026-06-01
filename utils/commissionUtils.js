
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

    // 1. Find the users in this chat
    const chatRes = await client.query('SELECT user_id, operator_id FROM chats WHERE id = $1', [chatId]);
    if (chatRes.rows.length === 0) return;
    
    const chatUserId = chatRes.rows[0].user_id;
    const chatOperatorId = chatRes.rows[0].operator_id;
    if (!chatUserId || !chatOperatorId) return;

    // Load details for both users in the chat to detect roles correctly
    const usersRes = await client.query(
        'SELECT id, role, gender, agency_id, managed_by, total_spent FROM users WHERE id::text IN ($1::text, $2::text)',
        [chatUserId, chatOperatorId]
    );
    const chatUsers = usersRes.rows;
    const femaleUser = chatUsers.find(u => (u.gender || '').toLowerCase() === 'kadin');
    const maleUser = chatUsers.find(u => (u.gender || '').toLowerCase() === 'erkek');

    let actualPayeeId;
    let customerId;
    let payeeData = null;

    if (femaleUser && maleUser) {
        // If there is one male and one female, the female is ALWAYS the payee/operator and the male is the customer
        actualPayeeId = femaleUser.id;
        customerId = maleUser.id;
        payeeData = femaleUser;
        console.log(`[COMMISSION-ROLES] Resolved by gender: Payee (Female) = ${actualPayeeId}, Customer (Male) = ${customerId}`);
    } else {
        // Fallback to standard chat roles
        const operatorId = chatOperatorId;
        const managerRes = await client.query('SELECT managed_by, role, gender, agency_id FROM users WHERE id::text = $1::text', [operatorId]);
        const avatarData = managerRes.rows[0] || {};
        
        let isSenderStaff = false;
        if (senderId && senderId !== '00000000-0000-0000-0000-000000000000') {
            const senderRes = await client.query('SELECT role FROM users WHERE id::text = $1::text', [senderId]);
            const senderRole = senderRes.rows.length > 0 ? senderRes.rows[0].role : 'user';
            isSenderStaff = ['staff', 'moderator', 'admin', 'super_admin', 'operator'].includes(senderRole);
        }

        actualPayeeId = operatorId;
        if (isSenderStaff) {
            actualPayeeId = senderId;
        } else if (avatarData.managed_by) {
            actualPayeeId = avatarData.managed_by;
        }

        const payeeRes = await client.query('SELECT agency_id, gender, id FROM users WHERE id = $1', [actualPayeeId]);
        payeeData = payeeRes.rows.length > 0 ? payeeRes.rows[0] : null;
        customerId = chatUserId;
        console.log(`[COMMISSION-ROLES] Resolved by fallback: Payee = ${actualPayeeId}, Customer = ${customerId}`);
    }

    if (!payeeData) return;
    const agencyId = payeeData.agency_id;
    const payeeGender = payeeData.gender;

    // RULE: Only female users who are in an agency can earn diamonds
    if (payeeGender !== 'kadin' || !agencyId) {
        console.log(`[COMMISSION-BYPASS] Operator/Payee ${actualPayeeId} bypassed. Gender: ${payeeGender}, Agency: ${agencyId}`);
        return;
    }
    
    let agencyData = null;
    if (agencyId) {
        const agencyRes = await client.query('SELECT * FROM agencies WHERE id = $1 AND status = \'active\'', [agencyId]);
        if (agencyRes.rows.length > 0) {
            agencyData = agencyRes.rows[0];
        }
    }

    // 1.6 Activity Tracking
    await client.query('UPDATE operators SET last_active_at = NOW() WHERE user_id = $1', [actualPayeeId]);

    // 2. Bonus Protection Check
    const userCheck = await client.query('SELECT total_spent FROM users WHERE id = $1', [customerId]);
    const userLifetimeSpent = userCheck.rows.length > 0 ? parseFloat(userCheck.rows[0].total_spent || 0) : 0;
    
    // Unified Economic Model: 2000 Diamonds = 1 USD (46 TL).
    // 1 spent Coin = 4.35 Diamonds earned.
    let baseRate = 4.35;
    
    // If customer has never spent money, use bonus rate (1/5th) to prevent spam/abuse
    if (userLifetimeSpent <= 0 && customerId) {
        const adminAddCheck = await client.query(
            "SELECT id FROM transactions WHERE user_id = $1 AND (type = 'admin_add' OR type = 'admin_edit' OR type = 'purchase') LIMIT 1", 
            [customerId]
        );
        if (adminAddCheck.rows.length === 0) {
            baseRate = 0.87; // Lower rate for non-paying organic users
        }
    }
    
    const earned = Math.round(cost * baseRate * 100) / 100; // Round to 2 decimal places
    if (earned <= 0 && cost > 0) return;

    // 3. Update PAYEE balance
    await client.query(
        `UPDATE operators SET 
            pending_balance = COALESCE(pending_balance, 0) + $1, 
            lifetime_earnings = COALESCE(lifetime_earnings, 0) + $1 
         WHERE user_id = $2`,
        [earned, actualPayeeId]
    );

    // 3.1 Update the last customer message as replied with the earned diamonds count
    let updatedMessageInfo = null;
    if (customerId && earned > 0) {
        try {
            // Find the latest message sent by the customer in this chat
            const lastMsgRes = await client.query(
                `SELECT id FROM messages 
                 WHERE chat_id = $1 AND sender_id = $2 AND content_type != 'gift'
                 ORDER BY created_at DESC LIMIT 1`,
                [chatId, customerId]
            );
            if (lastMsgRes.rows.length > 0) {
                const lastMsgId = lastMsgRes.rows[0].id;
                await client.query(
                    `UPDATE messages 
                     SET is_replied = true, earned_diamonds = COALESCE(earned_diamonds, 0) + $1 
                     WHERE id = $2`,
                    [earned, lastMsgId]
                );
                console.log(`[REPLY-TRACK] Marked message ${lastMsgId} as replied. Earned: ${earned} diamonds.`);
                updatedMessageInfo = { id: lastMsgId, is_replied: true, earned_diamonds: earned };
            }
        } catch (msgErr) {
            console.error('[REPLY-TRACK-ERROR] Failed to update message reply status:', msgErr.message);
        }
    }

    // 3.2 Update AGENCY balance (if applicable)
    if (agencyData) {
        const agencyRate = parseFloat(agencyData.commission_rate || 0.40);
        const agencyTotalEarned = cost * agencyRate;
        
        await client.query(
            `UPDATE agencies SET 
                pending_balance = COALESCE(pending_balance, 0) + $1, 
                lifetime_earnings = COALESCE(lifetime_earnings, 0) + $1 
             WHERE id = $2`,
            [agencyTotalEarned, agencyId]
        );
        
        console.log(`[AGENCY-PAYOUT] Agency ${agencyData.name} earned ${agencyTotalEarned} from transaction of ${cost}`);
    }

    // 3.5 Detailed Log for tracking
    try {
        if (chatId && actualPayeeId) {
            await client.query(
                'INSERT INTO commission_logs (operator_id, chat_id, amount, type, agency_id) VALUES ($1, $2, $3, $4, $5)',
                [actualPayeeId, chatId, earned, type, agencyId]
            );
        }
    } catch (logErr) {
        // If column doesn't exist yet, try without agency_id
        try {
            await client.query(
                'INSERT INTO commission_logs (operator_id, chat_id, amount, type) VALUES ($1, $2, $3, $4)',
                [actualPayeeId, chatId, earned, type]
            );
        } catch (inner) {
            console.error('[COMMISSION-LOG-ERROR] Failed to write detailed log:', inner.message);
        }
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
    return updatedMessageInfo;
}

module.exports = { recordOperatorCommission };
