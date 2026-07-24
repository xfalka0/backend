const db = require('../db');

async function runTest() {
    console.log('=== STARTING MISSION CLAIM INTEGRITY TEST ===');
    try {
        // 1. Find a test female user or operator
        const userRes = await db.query("SELECT id, username, gender, role FROM users WHERE gender = 'kadin' LIMIT 1");
        if (userRes.rows.length === 0) {
            console.log('No female user found for test!');
            process.exit(1);
        }

        const user = userRes.rows[0];
        const userId = user.id;
        console.log(`Testing with Female User: ${user.username} (ID: ${userId})`);

        // 2. Fetch current balance from operators table
        let opRes = await db.query('SELECT pending_balance, lifetime_earnings FROM operators WHERE user_id::text = $1::text', [userId]);
        let initialPending = opRes.rows.length > 0 ? parseFloat(opRes.rows[0].pending_balance || 0) : 0;
        let initialLifetime = opRes.rows.length > 0 ? parseFloat(opRes.rows[0].lifetime_earnings || 0) : 0;
        console.log(`Initial Balances -> Pending: ${initialPending} 💎 | Lifetime: ${initialLifetime} 💎`);

        // 3. Simulate claim for audio_calls milestone (e.g. 5,000 earnings milestone -> 1,000 reward)
        const missionId = 'audio_calls';
        const milestoneValue = 5000;
        const rewardAmount = 1000;

        console.log(`\nSimulating Claim for Mission: ${missionId}, Milestone: ${milestoneValue}, Reward: ${rewardAmount} 💎...`);

        // Perform claim logic exact step simulation
        await db.query('BEGIN');

        // Check sum already claimed today
        const claimedRes = await db.query(
            `SELECT COALESCE(SUM(amount), 0) as total_claimed 
             FROM commission_logs 
             WHERE operator_id::text = $1::text 
               AND type LIKE $2 
               AND created_at::date = CURRENT_DATE`,
            [userId, `mission_reward_${missionId}_%`]
        );
        const totalClaimedToday = parseFloat(claimedRes.rows[0].total_claimed || 0);
        const netReward = Math.max(0, parseFloat(rewardAmount) - totalClaimedToday);

        console.log(`Total claimed today for ${missionId}: ${totalClaimedToday} 💎. Net reward to credit: ${netReward} 💎.`);

        if (netReward > 0) {
            const opCheck = await db.query('SELECT user_id FROM operators WHERE user_id::text = $1::text', [userId]);
            if (opCheck.rows.length === 0) {
                await db.query(
                    'INSERT INTO operators (user_id, pending_balance, lifetime_earnings, is_online, rating) VALUES ($1, $2, $2, true, 5.0)',
                    [userId, netReward]
                );
            } else {
                await db.query(
                    'UPDATE operators SET pending_balance = COALESCE(pending_balance, 0) + $1, lifetime_earnings = COALESCE(lifetime_earnings, 0) + $1 WHERE user_id::text = $2::text',
                    [netReward, userId]
                );
            }

            await db.query(
                "INSERT INTO commission_logs (operator_id, amount, type) VALUES ($1, $2, $3)",
                [userId, netReward, `mission_reward_${missionId}_${milestoneValue}`]
            );
        }

        await db.query('COMMIT');

        // 4. Verify post-claim balances
        opRes = await db.query('SELECT pending_balance, lifetime_earnings FROM operators WHERE user_id::text = $1::text', [userId]);
        let newPending = parseFloat(opRes.rows[0].pending_balance || 0);
        let newLifetime = parseFloat(opRes.rows[0].lifetime_earnings || 0);

        console.log(`Updated Balances -> Pending: ${newPending} 💎 | Lifetime: ${newLifetime} 💎`);

        if (newPending === initialPending + netReward && newLifetime === initialLifetime + netReward) {
            console.log('\n✅ TEST SUCCESSFUL: Reward diamonds were correctly credited to pending_balance & lifetime_earnings!');
        } else {
            console.error('\n❌ TEST FAILED: Balance mismatch detected!');
        }

        // Cleanup test log entry to keep DB clean
        await db.query("DELETE FROM commission_logs WHERE operator_id::text = $1::text AND type = $2", [userId, `mission_reward_${missionId}_${milestoneValue}`]);
        await db.query('UPDATE operators SET pending_balance = $1, lifetime_earnings = $2 WHERE user_id::text = $3::text', [initialPending, initialLifetime, userId]);
        console.log('Test cleanup completed (restored initial balances).');

    } catch (err) {
        console.error('Test execution error:', err.message);
    } finally {
        process.exit(0);
    }
}

runTest();
