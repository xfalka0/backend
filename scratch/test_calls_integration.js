/**
 * Integration Test Suite for 1-to-1 Agora calling system (Audio & Video).
 * Simulates and verifies the upfront billing + connection timeout + reversal refund + idempotency.
 */
const db = require('../db');
const { recordOperatorCommission } = require('../utils/commissionUtils');

const activeCallSessions = new Map();

function isUserInAnyActiveCall(userId) {
    if (!userId) return false;
    const uIdStr = userId.toString();
    for (const session of activeCallSessions.values()) {
        if (session.status !== 'ended' && (session.callerId.toString() === uIdStr || session.receiverId.toString() === uIdStr)) {
            return true;
        }
    }
    return false;
}

// Upfront charging function matching socketHandler.js
async function chargeCallMinute(io, chatId, callerId, receiverId, callId, callType = 'audio') {
    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');

        const userRes = await client.query('SELECT balance, role FROM users WHERE id = $1 FOR UPDATE', [callerId]);
        if (userRes.rows.length === 0) throw new Error('Caller not found');

        const currentBalance = parseFloat(userRes.rows[0].balance || 0);
        const userRole = userRes.rows[0].role;
        const isManagement = ['admin', 'super_admin', 'moderator', 'staff', 'operator'].includes(userRole);

        const callerGenderRes = await client.query('SELECT gender FROM users WHERE id = $1', [callerId]);
        const callerGender = (callerGenderRes.rows[0]?.gender || '').toLowerCase();
        const isFreeCaller = isManagement || callerGender === 'kadin';

        const costPerMinute = callType === 'video' ? 120 : 50;

        if (!isFreeCaller) {
            if (currentBalance < costPerMinute) {
                await client.query('ROLLBACK');
                return { success: false, reason: 'insufficient_funds' };
            }

            await client.query('UPDATE users SET balance = balance - $2 WHERE id = $1', [callerId, costPerMinute]);
            await recordOperatorCommission(client, chatId, receiverId, costPerMinute, 'call', callId);
            await client.query('COMMIT');
            return { success: true, newBalance: currentBalance - costPerMinute };
        } else {
            await client.query('COMMIT');
            return { success: true, newBalance: currentBalance, isFree: true };
        }
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Charge minute error:', err.message);
        return { success: false, reason: 'error' };
    } finally {
        if (client) client.release();
    }
}

// Refund function matching socketHandler.js (Reversal Entry instead of deletion)
async function refundFirstMinute(io, callerId, receiverId, chatId, callId, callType = 'audio') {
    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');

        const costPerMinute = callType === 'video' ? 120 : 50;

        // Verify if caller is free caller (no need to refund if no coin was deducted)
        const userRes = await client.query('SELECT role, gender FROM users WHERE id = $1', [callerId]);
        const userRole = userRes.rows[0]?.role;
        const callerGender = (userRes.rows[0]?.gender || '').toLowerCase();
        const isManagement = ['admin', 'super_admin', 'moderator', 'staff', 'operator'].includes(userRole);
        const isFreeCaller = isManagement || callerGender === 'kadin';

        if (!isFreeCaller) {
            // Unique Check: verify if refund has already been recorded for this callId
            if (callId) {
                const refundCheck = await client.query(
                    "SELECT 1 FROM commission_logs WHERE call_id = $1 AND type = 'refund'",
                    [callId]
                );
                if (refundCheck.rows.length > 0) {
                    console.log(`[CALL REFUND] Already refunded for callId ${callId}. Bypassing duplicate refund.`);
                    await client.query('COMMIT');
                    return;
                }
            }

            // Refund User A (Caller)
            await client.query('UPDATE users SET balance = balance + $2 WHERE id = $1', [callerId, costPerMinute]);

            // Fetch the original commission log to reverse
            let earnedAmount = 0;
            let agencyId = null;

            if (callId) {
                const commRes = await client.query(
                    `SELECT amount, agency_id FROM commission_logs 
                     WHERE call_id = $1 AND type = 'call'
                     ORDER BY created_at DESC LIMIT 1`,
                    [callId]
                );

                if (commRes.rows.length > 0) {
                    earnedAmount = parseFloat(commRes.rows[0].amount);
                    agencyId = commRes.rows[0].agency_id;
                }
            }

            if (earnedAmount > 0) {
                // Insert negative reversal log entry instead of deleting
                const refundEarned = -earnedAmount;
                await client.query(
                    "INSERT INTO commission_logs (operator_id, chat_id, amount, type, agency_id, call_id) VALUES ($1, $2, $3, 'refund', $4, $5)",
                    [receiverId, chatId, refundEarned, agencyId, callId]
                );

                // Update operator pending balance and lifetime earnings
                await client.query(
                    `UPDATE operators SET 
                        pending_balance = GREATEST(0, COALESCE(pending_balance, 0) - $1), 
                        lifetime_earnings = GREATEST(0, COALESCE(lifetime_earnings, 0) - $1) 
                     WHERE user_id = $2`,
                    [earnedAmount, receiverId]
                );

                // Reverse agency balance if applicable
                if (agencyId) {
                    const agencyRate = 0.40;
                    const agencyRefund = earnedAmount * agencyRate;
                    await client.query(
                        `UPDATE agencies SET 
                            pending_balance = GREATEST(0, COALESCE(pending_balance, 0) - $1), 
                            lifetime_earnings = GREATEST(0, COALESCE(lifetime_earnings, 0) - $1) 
                         WHERE id = $2`,
                        [agencyRefund, agencyId]
                    );
                }

                // Update daily stats (reduce coins_earned)
                await client.query(
                    `UPDATE operator_stats SET 
                        coins_earned = GREATEST(0, COALESCE(coins_earned, 0) - $1),
                        total_user_spend = GREATEST(0, COALESCE(total_user_spend, 0) - $2)
                     WHERE operator_id::text = $3::text AND date = CURRENT_DATE`,
                    [earnedAmount, costPerMinute, receiverId]
                );
            }
        }

        await client.query('COMMIT');
        io.emitted.push({ event: 'refund_successful', callerId, callId, callType });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Refund error:', err.message);
    } finally {
        if (client) client.release();
    }
}

async function simulateEndCallSession(io, chatId, reason) {
    const session = activeCallSessions.get(chatId);
    if (!session || session.status === 'ended') return;

    const callType = session.callType || 'audio';
    if (session.status === 'paid_pending_connection') {
        await refundFirstMinute(io, session.callerId, session.receiverId, chatId, session.callId, callType);
    }

    session.status = 'ended';
    session.endedAt = new Date();
    activeCallSessions.delete(chatId);

    const durationSeconds = Math.round((session.endedAt - session.startedAt) / 1000);
    
    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');
        const stubContent = JSON.stringify({
            duration: '0:01',
            durationSeconds,
            reason,
            callType,
            status: reason === 'insufficient_funds' ? 'insufficient_funds' : 'ended',
            call_id: session.callId
        });
        await client.query(
            `INSERT INTO messages (chat_id, sender_id, content, content_type, is_unlocked) VALUES ($1, $2, $3, 'call_stub', true)`,
            [chatId, session.callerId, stubContent]
        );
        await client.query('COMMIT');
    } finally {
        if (client) client.release();
    }
    io.emitted.push({ event: 'call_ended', chatId, reason });
}

async function simulateLogMissedCall(io, chatId, callerId, receiverId, status) {
    const session = activeCallSessions.get(chatId);
    if (!session || session.status === 'ended') return;

    const callType = session.callType || 'audio';
    if (session.status === 'paid_pending_connection') {
        await refundFirstMinute(io, session.callerId, session.receiverId, chatId, session.callId, callType);
    }

    session.status = 'ended';
    activeCallSessions.delete(chatId);

    let client;
    try {
        client = await db.pool.connect();
        await client.query('BEGIN');
        const stubContent = JSON.stringify({
            duration: '0:00',
            durationSeconds: 0,
            reason: status,
            callType,
            status,
            call_id: session.callId
        });
        await client.query(
            `INSERT INTO messages (chat_id, sender_id, content, content_type, is_unlocked) VALUES ($1, $2, $3, 'call_stub', true)`,
            [chatId, callerId, stubContent]
        );
        await client.query('COMMIT');
    } finally {
        if (client) client.release();
    }
    io.emitted.push({ event: 'call_ended', chatId, reason: status });
}

async function handleConnectionFailure(io, chatId) {
    const session = activeCallSessions.get(chatId);
    if (!session || session.status === 'ended') return;

    const callType = session.callType || 'audio';
    if (session.status === 'paid_pending_connection') {
        await refundFirstMinute(io, session.callerId, session.receiverId, chatId, session.callId, callType);
    }

    session.status = 'ended';
    activeCallSessions.delete(chatId);

    io.emitted.push({ event: 'call_ended', chatId, reason: 'connection_failed' });
}

async function runTests() {
    console.log('🧪 Starting Reversal Call Billing (Audio & Video) & Refund Integration Testing...');

    const userA = 999991;
    const userB = 999992;
    const userC = 999993;
    const chatId = 999999;

    const cleanDb = async () => {
        await db.query('DELETE FROM commission_logs WHERE chat_id = $1', [chatId]);
        await db.query('DELETE FROM messages WHERE chat_id = $1', [chatId]);
        await db.query('DELETE FROM chats WHERE id = $1', [chatId]);
        await db.query('DELETE FROM operators WHERE user_id = $1', [userB]);
        await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [userA, userB, userC]);
    };

    try {
        await cleanDb();

        await db.query(
            `INSERT INTO users (id, username, role, gender, balance, account_status)
             VALUES 
             ($1, 'male_cust', 'user', 'erkek', 120, 'active'),
             ($2, 'female_op', 'operator', 'kadin', 0, 'active'),
             ($3, 'other_male', 'user', 'erkek', 100, 'active')`,
            [userA, userB, userC]
        );
        await db.query(
            `INSERT INTO operators (user_id, rating, is_online) VALUES ($1, 5.0, true)`,
            [userB]
        );
        await db.query(
            `INSERT INTO chats (id, user_id, operator_id) VALUES ($1, $2, $3)`,
            [chatId, userA, userB]
        );

        const mockIo = {
            emitted: []
        };

        // ─────────────────────────────────────────────────────────────────────
        // SCENARIO 1: Normal upfront billing and successful connection (AUDIO)
        // ─────────────────────────────────────────────────────────────────────
        console.log('\n--- Running Scenario 1: Normal Call & Upfront Charge (AUDIO) ---');
        activeCallSessions.set(chatId, {
            callId: 'call_s1',
            callerId: userA,
            receiverId: userB,
            status: 'ringing',
            callType: 'audio',
            startedAt: new Date()
        });

        const upfrontCharged = await chargeCallMinute(mockIo, chatId, userA, userB, 'call_s1', 'audio');
        if (!upfrontCharged.success) throw new Error('Scenario 1: Upfront charge failed');

        const balAfterUpfront = parseInt((await db.query('SELECT balance FROM users WHERE id = $1', [userA])).rows[0].balance);
        console.log(`User A Balance after Upfront charge (Audio): ${balAfterUpfront} (Expected: 70)`);
        if (balAfterUpfront !== 70) throw new Error('Scenario 1: Balance mismatch');

        const session1 = activeCallSessions.get(chatId);
        session1.status = 'paid_pending_connection';
        session1.status = 'active';
        session1.acceptedAt = new Date();

        await simulateEndCallSession(mockIo, chatId, 'ended');
        const endEvent = mockIo.emitted.find(e => e.event === 'call_ended');
        console.log('Call Ended Event:', endEvent);
        if (!endEvent || endEvent.reason !== 'ended') throw new Error('Scenario 1: End failed');

        console.log('✅ Scenario 1 Passed.');

        // ─────────────────────────────────────────────────────────────────────
        // SCENARIO 2: Connection Timeout & Reversal Refund (AUDIO)
        // ─────────────────────────────────────────────────────────────────────
        console.log('\n--- Running Scenario 2: Connection Timeout & Reversal Refund (AUDIO) ---');
        mockIo.emitted = [];
        await db.query('UPDATE users SET balance = 120 WHERE id = $1', [userA]);

        activeCallSessions.set(chatId, {
            callId: 'call_s2',
            callerId: userA,
            receiverId: userB,
            status: 'ringing',
            callType: 'audio',
            startedAt: new Date()
        });

        await chargeCallMinute(mockIo, chatId, userA, userB, 'call_s2', 'audio');
        const session2 = activeCallSessions.get(chatId);
        session2.status = 'paid_pending_connection';

        await handleConnectionFailure(mockIo, chatId);

        const refundEvent2 = mockIo.emitted.find(e => e.event === 'refund_successful');
        console.log('Was Caller Refunded on Timeout?:', !!refundEvent2);
        if (!refundEvent2) throw new Error('Scenario 2: Failed to refund on timeout');

        const balAfterTimeout = parseInt((await db.query('SELECT balance FROM users WHERE id = $1', [userA])).rows[0].balance);
        console.log(`User A Balance after Timeout Refund: ${balAfterTimeout} (Expected: 120)`);
        if (balAfterTimeout !== 120) throw new Error('Scenario 2: Refund balance mismatch');

        console.log('✅ Scenario 2 Passed.');

        // ─────────────────────────────────────────────────────────────────────
        // SCENARIO 3: Normal Görüntülü Arama (VIDEO)
        // ─────────────────────────────────────────────────────────────────────
        console.log('\n--- Running Scenario 3: Video Call upfront charge (120 coins) ---');
        mockIo.emitted = [];
        await db.query('UPDATE users SET balance = 120 WHERE id = $1', [userA]);

        activeCallSessions.set(chatId, {
            callId: 'call_video_s3',
            callerId: userA,
            receiverId: userB,
            status: 'ringing',
            callType: 'video',
            startedAt: new Date()
        });

        // Upfront Charge should deduct 120 coins for video!
        const upfrontChargedVideo = await chargeCallMinute(mockIo, chatId, userA, userB, 'call_video_s3', 'video');
        if (!upfrontChargedVideo.success) throw new Error('Scenario 3: Upfront video charge failed');

        const balAfterVideoUpfront = parseInt((await db.query('SELECT balance FROM users WHERE id = $1', [userA])).rows[0].balance);
        console.log(`User A Balance after Upfront charge (Video): ${balAfterVideoUpfront} (Expected: 0)`);
        if (balAfterVideoUpfront !== 0) throw new Error('Scenario 3: Balance mismatch');

        const session3 = activeCallSessions.get(chatId);
        session3.status = 'paid_pending_connection';
        session3.status = 'active';
        session3.acceptedAt = new Date();

        await simulateEndCallSession(mockIo, chatId, 'ended');
        console.log('✅ Scenario 3 Passed.');

        // ─────────────────────────────────────────────────────────────────────
        // SCENARIO 4: Video Call connection failure refund (120 coins)
        // ─────────────────────────────────────────────────────────────────────
        console.log('\n--- Running Scenario 4: Video Call Connection Failure & Refund (120 coins) ---');
        mockIo.emitted = [];
        await db.query('UPDATE users SET balance = 120 WHERE id = $1', [userA]);

        activeCallSessions.set(chatId, {
            callId: 'call_video_s4',
            callerId: userA,
            receiverId: userB,
            status: 'ringing',
            callType: 'video',
            startedAt: new Date()
        });

        // Upfront Charge (120 coins)
        await chargeCallMinute(mockIo, chatId, userA, userB, 'call_video_s4', 'video');

        const session4 = activeCallSessions.get(chatId);
        session4.status = 'paid_pending_connection';

        // Fail connection
        await handleConnectionFailure(mockIo, chatId);

        const refundEvent4 = mockIo.emitted.find(e => e.event === 'refund_successful');
        console.log('Was Caller Refunded 120 coins for Video Call?:', !!refundEvent4);
        if (!refundEvent4) throw new Error('Scenario 4: Failed to refund video call');

        const balAfterVideoRefund = parseInt((await db.query('SELECT balance FROM users WHERE id = $1', [userA])).rows[0].balance);
        console.log(`User A Balance after Video Refund: ${balAfterVideoRefund} (Expected: 120)`);
        if (balAfterVideoRefund !== 120) throw new Error('Scenario 4: Refund balance mismatch');

        console.log('✅ Scenario 4 Passed.');

        // ─────────────────────────────────────────────────────────────────────
        // SCENARIO 5: Idempotency (Duplicate Refund protection for Video)
        // ─────────────────────────────────────────────────────────────────────
        console.log('\n--- Running Scenario 5: Refund Idempotency Protection (VIDEO) ---');
        mockIo.emitted = [];
        await db.query('UPDATE users SET balance = 120 WHERE id = $1', [userA]);
        
        // 1. Charge upfront for video (120 coins)
        await chargeCallMinute(mockIo, chatId, userA, userB, 'call_video_s5', 'video');

        // 2. Perform refund first time
        await refundFirstMinute(mockIo, userA, userB, chatId, 'call_video_s5', 'video');
        const refundCount = mockIo.emitted.filter(e => e.event === 'refund_successful').length;
        console.log(`1st Refund processed? refund count: ${refundCount}`);

        // 3. Perform refund second time (duplicate refund attempt)
        await refundFirstMinute(mockIo, userA, userB, chatId, 'call_video_s5', 'video');
        const refundCount2 = mockIo.emitted.filter(e => e.event === 'refund_successful').length;
        console.log(`2nd Refund processed? refund count: ${refundCount2}`);

        if (refundCount2 !== 1) throw new Error('Scenario 5: Duplicate refund occurred');

        // Verify balance remains exactly 120
        const balFinalS5 = parseInt((await db.query('SELECT balance FROM users WHERE id = $1', [userA])).rows[0].balance);
        console.log(`User A Balance after duplicate refund attempts: ${balFinalS5} (Expected: 120)`);
        if (balFinalS5 !== 120) throw new Error('Scenario 5: Idempotency balance mismatch');

        console.log('✅ Scenario 5 Passed.');

        console.log('\n🏆 ALL AUDIO & VIDEO CHARGE, REFUND & IDEMPOTENCY SCENARIOS VERIFIED SUCCESSFULLY!');
    } finally {
        await cleanDb();
    }
}

runTests().catch(err => {
    console.error('❌ Integration tests failed:', err.message);
    process.exit(1);
});
