const db = require('../db');
const { recordOperatorCommission } = require('../utils/commissionUtils');

async function runTest() {
    console.log('=== STARTING AGENCY COMMISSION FLOW TEST ===\n');
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');
        
        // Ensure local database schema matches with gift_coins_received column
        await client.query('ALTER TABLE operator_stats ADD COLUMN IF NOT EXISTS gift_coins_received NUMERIC DEFAULT 0');

        // 1. Create a test agency
        console.log('[Test] Creating test agency...');
        const agencyRes = await client.query(`
            INSERT INTO agencies (name, commission_rate, status)
            VALUES ('Test Agency Elite', 0.40, 'active')
            RETURNING id, name, commission_rate
        `);
        const agency = agencyRes.rows[0];
        console.log(`Created Agency: ${agency.name} (ID: ${agency.id})`);

        // 2. Create a test female operator
        console.log('[Test] Creating test female operator...');
        const operatorUserRes = await client.query(`
            INSERT INTO users (username, email, role, gender, display_name, agency_id, total_spent)
            VALUES ('test_female_op_' || gen_random_uuid()::text, 'female_op@test.com', 'operator', 'kadin', 'Sudenur Test', $1, 0)
            RETURNING id, username, gender
        `, [agency.id]);
        const opUser = operatorUserRes.rows[0];
        console.log(`Created Operator User: ${opUser.username} (ID: ${opUser.id})`);

        // Create operator profile entry
        await client.query(`
            INSERT INTO operators (user_id, category, bio, pending_balance, lifetime_earnings)
            VALUES ($1, 'Genel', 'Test operator bio', 0, 0)
        `, [opUser.id]);

        // 3. Create a test male user
        console.log('[Test] Creating test male user...');
        
        // Scenario A: Non-paying male user
        const customerNonPayingRes = await client.query(`
            INSERT INTO users (username, email, role, gender, display_name, total_spent)
            VALUES ('test_male_np_' || gen_random_uuid()::text, 'male_np@test.com', 'user', 'erkek', 'Arda NP Test', 0)
            RETURNING id, username
        `);
        const npUser = customerNonPayingRes.rows[0];
        console.log(`Created Non-Paying User: ${npUser.username} (ID: ${npUser.id})`);

        // Scenario B: Paying male user
        const customerPayingRes = await client.query(`
            INSERT INTO users (username, email, role, gender, display_name, total_spent)
            VALUES ('test_male_p_' || gen_random_uuid()::text, 'male_p@test.com', 'user', 'erkek', 'Arda P Test', 500.00)
            RETURNING id, username
        `);
        const pUser = customerPayingRes.rows[0];
        console.log(`Created Paying User: ${pUser.username} (ID: ${pUser.id})`);

        // 4. Create chat sessions
        console.log('[Test] Creating chat sessions...');
        const chatNPRes = await client.query(`
            INSERT INTO chats (user_id, operator_id, last_message)
            VALUES ($1, $2, 'Hello NP')
            RETURNING id
        `, [npUser.id, opUser.id]);
        const chatNPId = chatNPRes.rows[0].id;

        const chatPRes = await client.query(`
            INSERT INTO chats (user_id, operator_id, last_message)
            VALUES ($1, $2, 'Hello P')
            RETURNING id
        `, [pUser.id, opUser.id]);
        const chatPId = chatPRes.rows[0].id;

        // 5. Test Case 1: Non-Paying User spends 10 coins (should earn 0.87 diamonds/coin)
        console.log('\n--- TEST CASE 1: Non-Paying User spends 10 coins ---');
        await recordOperatorCommission(client, chatNPId, npUser.id, 10, 'text');

        // Check operator stats & balances
        let opProfile = await client.query('SELECT pending_balance, lifetime_earnings FROM operators WHERE user_id = $1', [opUser.id]);
        let agencyProfile = await client.query('SELECT pending_balance, lifetime_earnings FROM agencies WHERE id = $1', [agency.id]);
        
        console.log(`Operator Balance: ${opProfile.rows[0].pending_balance} diamonds (Expected: 8.7)`);
        console.log(`Agency Balance: ${agencyProfile.rows[0].pending_balance} diamonds (Expected: 3.48, which is 40% of 8.7)`);

        // Reset operator balance for next test case
        await client.query('UPDATE operators SET pending_balance = 0 WHERE user_id = $1', [opUser.id]);
        await client.query('UPDATE agencies SET pending_balance = 0 WHERE id = $1', [agency.id]);

        // 6. Test Case 2: Paying User spends 10 coins (should earn 4.35 diamonds/coin)
        console.log('\n--- TEST CASE 2: Paying User spends 10 coins ---');
        await recordOperatorCommission(client, chatPId, pUser.id, 10, 'text');

        // Check operator stats & balances
        opProfile = await client.query('SELECT pending_balance, lifetime_earnings FROM operators WHERE user_id = $1', [opUser.id]);
        agencyProfile = await client.query('SELECT pending_balance, lifetime_earnings FROM agencies WHERE id = $1', [agency.id]);

        console.log(`Operator Balance: ${opProfile.rows[0].pending_balance} diamonds (Expected: 43.5)`);
        console.log(`Agency Balance: ${agencyProfile.rows[0].pending_balance} diamonds (Expected: 17.4, which is 40% of 43.5)`);

        // Check commission logs
        const logs = await client.query('SELECT * FROM commission_logs WHERE operator_id::text = $1::text', [opUser.id]);
        console.log(`\nCommission Logs recorded: ${logs.rows.length} rows`);
        logs.rows.forEach(log => {
            console.log(`  - Type: ${log.type}, Amount: ${log.amount} diamonds, Agency: ${log.agency_id ? 'YES' : 'NO'}`);
        });

        // Check operator daily stats
        const stats = await client.query('SELECT * FROM operator_stats WHERE operator_id::text = $1::text', [opUser.id]);
        console.log(`Daily stats records: ${stats.rows.length} rows`);
        if (stats.rows.length > 0) {
            console.log(`  - Coins Earned Today: ${stats.rows[0].coins_earned} diamonds`);
            console.log(`  - User Spend Today: ${stats.rows[0].total_user_spend} coins`);
        }

        console.log('\n=== TEST COMPLETED SUCCESSFULLY! ===');
        await client.query('ROLLBACK'); // Transaction rollback to keep DB clean
        console.log('[Test] Changes rolled back. DB is clean.');
    } catch (e) {
        console.error('\n❌ TEST FAILED WITH ERROR:', e);
        try {
            await client.query('ROLLBACK');
            console.log('[Test] Rolled back after failure.');
        } catch (rollbackErr) {
            console.error('Failed to rollback:', rollbackErr);
        }
    } finally {
        client.release();
    }
}

runTest();
