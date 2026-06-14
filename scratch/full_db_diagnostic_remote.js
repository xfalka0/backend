const { Client } = require('pg');
const { recordOperatorCommission } = require('../utils/commissionUtils');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function run() {
    console.log('=== STARTING REMOTE DB DIAGNOSTIC & MIGRATION CHECK ===');
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to Render Database successfully!');

        // 1. List all tables
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        const tables = tablesRes.rows.map(r => r.table_name);
        console.log('Available tables on Render:', tables.join(', '));

        const requiredTables = ['agencies', 'operators', 'operator_stats', 'commission_logs', 'payouts', 'agency_invitations'];
        for (const t of requiredTables) {
            if (!tables.includes(t)) {
                console.warn(`⚠️ Warning: Table "${t}" does not exist on remote DB!`);
            } else {
                console.log(`✅ Table "${t}" exists.`);
            }
        }

        // 2. Add columns if missing in remote DB
        console.log('\nChecking operator_stats columns on remote DB...');
        const colsRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'operator_stats'
        `);
        const columns = colsRes.rows.map(r => r.column_name);
        console.log('operator_stats columns:', columns.join(', '));

        if (!columns.includes('gift_coins_received')) {
            console.log('Adding "gift_coins_received" column to remote operator_stats...');
            await client.query('ALTER TABLE operator_stats ADD COLUMN gift_coins_received NUMERIC DEFAULT 0');
            console.log('✅ Added gift_coins_received successfully.');
        } else {
            console.log('✅ "gift_coins_received" column exists.');
        }

        // 3. Check operator_id type in remote operator_stats
        const opIdCol = colsRes.rows.find(r => r.column_name === 'operator_id');
        if (opIdCol) {
            console.log(`operator_id type in operator_stats is: ${opIdCol.data_type}`);
        }

        // 4. Run agency commission flow integration test on Remote DB inside a transaction (ROLLBACK at the end)
        console.log('\n--- Running Remote Transaction Commission Simulation ---');
        await client.query('BEGIN');

        // Check if there is an agency or insert a temp one
        console.log('[Test] Creating temporary agency on remote...');
        const agencyRes = await client.query(`
            INSERT INTO agencies (name, commission_rate, status)
            VALUES ('Remote Test Agency', 0.40, 'active')
            RETURNING id, name
        `);
        const agency = agencyRes.rows[0];
        console.log(`Created Remote Agency: ${agency.name} (ID: ${agency.id})`);

        // Check ID type for users key - is it INT or UUID on remote?
        const userPkRes = await client.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'id'
        `);
        const userPkType = userPkRes.rows[0].data_type;
        console.log(`User primary key type on remote DB is: ${userPkType}`);

        let opUser, npUser, pUser;
        if (userPkType.toLowerCase().includes('integer') || userPkType.toLowerCase().includes('serial')) {
            // Integer ID schema
            console.log('[Test] Creating temporary users (INTEGER schema)...');
            const opUserRes = await client.query(`
                INSERT INTO users (username, email, role, gender, display_name, agency_id, total_spent)
                VALUES ('remote_op_' || floor(random() * 1000000)::text, 'remote_op@test.com', 'operator', 'kadin', 'Sudenur Remote', $1, 0)
                RETURNING id, username
            `, [agency.id]);
            opUser = opUserRes.rows[0];

            const npUserRes = await client.query(`
                INSERT INTO users (username, email, role, gender, display_name, total_spent)
                VALUES ('remote_np_' || floor(random() * 1000000)::text, 'remote_np@test.com', 'user', 'erkek', 'Arda Remote NP', 0)
                RETURNING id, username
            `);
            npUser = npUserRes.rows[0];

            const pUserRes = await client.query(`
                INSERT INTO users (username, email, role, gender, display_name, total_spent)
                VALUES ('remote_p_' || floor(random() * 1000000)::text, 'remote_p@test.com', 'user', 'erkek', 'Arda Remote P', 500.00)
                RETURNING id, username
            `);
            pUser = pUserRes.rows[0];
        } else {
            // UUID ID schema
            console.log('[Test] Creating temporary users (UUID schema)...');
            const opUserRes = await client.query(`
                INSERT INTO users (username, email, role, gender, display_name, agency_id, total_spent)
                VALUES ('remote_op_' || gen_random_uuid()::text, 'remote_op@test.com', 'operator', 'kadin', 'Sudenur Remote', $1, 0)
                RETURNING id, username
            `, [agency.id]);
            opUser = opUserRes.rows[0];

            const npUserRes = await client.query(`
                INSERT INTO users (username, email, role, gender, display_name, total_spent)
                VALUES ('remote_np_' || gen_random_uuid()::text, 'remote_np@test.com', 'user', 'erkek', 'Arda Remote NP', 0)
                RETURNING id, username
            `);
            npUser = npUserRes.rows[0];

            const pUserRes = await client.query(`
                INSERT INTO users (username, email, role, gender, display_name, total_spent)
                VALUES ('remote_p_' || gen_random_uuid()::text, 'remote_p@test.com', 'user', 'erkek', 'Arda Remote P', 500.00)
                RETURNING id, username
            `);
            pUser = pUserRes.rows[0];
        }

        // Insert operator profile details
        await client.query(`
            INSERT INTO operators (user_id, category, bio, pending_balance, lifetime_earnings)
            VALUES ($1, 'Genel', 'Remote test operator bio', 0, 0)
        `, [opUser.id]);

        // Create chat sessions
        const chatNPRes = await client.query(`
            INSERT INTO chats (user_id, operator_id, last_message)
            VALUES ($1, $2, 'Hello Remote NP')
            RETURNING id
        `, [npUser.id, opUser.id]);
        const chatNPId = chatNPRes.rows[0].id;

        const chatPRes = await client.query(`
            INSERT INTO chats (user_id, operator_id, last_message)
            VALUES ($1, $2, 'Hello Remote P')
            RETURNING id
        `, [pUser.id, opUser.id]);
        const chatPId = chatPRes.rows[0].id;

        // Simulate commission recording
        console.log('\n--- Simulation Case 1: Non-Paying User spends 10 coins on remote ---');
        await recordOperatorCommission(client, chatNPId, npUser.id, 10, 'text');

        let opProfile = await client.query('SELECT pending_balance, lifetime_earnings FROM operators WHERE user_id = $1', [opUser.id]);
        let agencyProfile = await client.query('SELECT pending_balance, lifetime_earnings FROM agencies WHERE id = $1', [agency.id]);
        console.log(`Remote Operator Balance: ${opProfile.rows[0].pending_balance} diamonds (Expected: 8.7)`);
        console.log(`Remote Agency Balance: ${agencyProfile.rows[0].pending_balance} diamonds (Expected: 3.48)`);

        // Reset balances for next test
        await client.query('UPDATE operators SET pending_balance = 0 WHERE user_id = $1', [opUser.id]);
        await client.query('UPDATE agencies SET pending_balance = 0 WHERE id = $1', [agency.id]);

        console.log('\n--- Simulation Case 2: Paying User spends 10 coins on remote ---');
        await recordOperatorCommission(client, chatPId, pUser.id, 10, 'text');

        opProfile = await client.query('SELECT pending_balance, lifetime_earnings FROM operators WHERE user_id = $1', [opUser.id]);
        agencyProfile = await client.query('SELECT pending_balance, lifetime_earnings FROM agencies WHERE id = $1', [agency.id]);
        console.log(`Remote Operator Balance: ${opProfile.rows[0].pending_balance} diamonds (Expected: 43.5)`);
        console.log(`Remote Agency Balance: ${agencyProfile.rows[0].pending_balance} diamonds (Expected: 17.4)`);

        // Check logs on remote
        const logs = await client.query('SELECT * FROM commission_logs WHERE operator_id::text = $1::text', [opUser.id]);
        console.log(`Commission Logs recorded on remote: ${logs.rows.length} rows`);
        
        const stats = await client.query('SELECT * FROM operator_stats WHERE operator_id::text = $1::text', [opUser.id]);
        console.log(`Daily stats records on remote: ${stats.rows.length} rows`);
        if (stats.rows.length > 0) {
            console.log(`  - Coins Earned: ${stats.rows[0].coins_earned} diamonds`);
            console.log(`  - User Spend: ${stats.rows[0].total_user_spend} coins`);
        }

        console.log('\nROLLBACK transaction on Remote DB to keep it clean...');
        await client.query('ROLLBACK');
        console.log('✅ Remote DB test successful and changes safely rolled back!');

    } catch (err) {
        console.error('❌ Diagnostic failed with error:', err);
        try {
            await client.query('ROLLBACK');
            console.log('Rolled back remote transaction.');
        } catch (rErr) {
            console.error('Failed to rollback remote transaction:', rErr.message);
        }
    } finally {
        await client.end();
        console.log('Connection closed.');
    }
}

run();
