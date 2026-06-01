const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function run() {
    console.log('--- CONNECTING TO PRODUCTION RENDER DB ---');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        // 1. Add agency_id to users
        console.log('Adding agency_id column to users table...');
        await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_id TEXT');
        console.log('✅ Column agency_id added/verified in users table.');

        // 2. Check if any agency exists
        const agencyCheck = await client.query('SELECT * FROM agencies LIMIT 1');
        let agencyId;
        if (agencyCheck.rows.length === 0) {
            console.log('No agencies exist. Creating default active agency...');
            const insertAgency = await client.query(`
                INSERT INTO agencies (name, commission_rate, status) 
                VALUES ('Fiva Agency', 0.40, 'active') 
                RETURNING id
            `);
            agencyId = insertAgency.rows[0].id;
            console.log(`✅ Default agency 'Fiva Agency' created with ID: ${agencyId}`);
        } else {
            agencyId = agencyCheck.rows[0].id;
            console.log(`Using existing agency: ${agencyCheck.rows[0].name} (ID: ${agencyId})`);
        }

        // 3. Assign female user 591 to this agency
        console.log('Assigning female user 591 (furkandn012) to the agency...');
        await client.query('UPDATE users SET agency_id = $1 WHERE id = $2', [agencyId.toString(), '591']);
        console.log('✅ User 591 successfully assigned to the agency.');

        // 4. Verify Sudenur's updated user status
        const verifyRes = await client.query('SELECT id, username, role, gender, agency_id FROM users WHERE id = $1', ['591']);
        console.log('Updated user record:', verifyRes.rows[0]);

        // 5. Let's also check if there is an operator profile for her.
        // In server.js, operators are matched by user_id. Let's see if an operator profile exists for user 591.
        const opCheck = await client.query('SELECT * FROM operators WHERE user_id = $1', ['591']);
        if (opCheck.rows.length === 0) {
            console.log('No operator record found for user 591. Creating one...');
            await client.query(
                "INSERT INTO operators (user_id, category, bio, photos, is_online, rating) VALUES ($1, 'Genel', 'Merhaba!', '{}', false, 5.0)",
                ['591']
            );
            console.log('✅ Operator profile successfully created for user 591.');
        } else {
            console.log('Operator profile already exists for user 591.');
        }

    } catch (err) {
        console.error('Error during migration:', err.message);
    } finally {
        await client.end();
    }
}

run();
