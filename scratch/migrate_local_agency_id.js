const db = require('../db');

async function run() {
    try {
        console.log('--- CONNECTING TO LOCAL DB ---');
        // 1. Add agency_id to users
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_id TEXT');
        console.log('✅ Column agency_id added/verified in users table locally.');

        // 2. Check/Create default agency locally
        const agencyCheck = await db.query('SELECT * FROM agencies LIMIT 1');
        let agencyId;
        if (agencyCheck.rows.length === 0) {
            const insertAgency = await db.query(`
                INSERT INTO agencies (name, commission_rate, status) 
                VALUES ('Fiva Agency', 0.40, 'active') 
                RETURNING id
            `);
            agencyId = insertAgency.rows[0].id;
            console.log(`✅ Default agency 'Fiva Agency' created locally with ID: ${agencyId}`);
        } else {
            agencyId = agencyCheck.rows[0].id;
            console.log(`Using existing agency locally: ${agencyCheck.rows[0].name} (ID: ${agencyId})`);
        }

        // 3. Assign all local female users to this agency
        await db.query("UPDATE users SET agency_id = $1 WHERE gender = 'kadin'", [agencyId.toString()]);
        console.log('✅ Assigned all local female users to the default agency.');

        // 4. Verify operators profiles locally
        const kadinUsers = await db.query("SELECT id, username FROM users WHERE gender = 'kadin'");
        for (const user of kadinUsers.rows) {
            const opCheck = await db.query('SELECT * FROM operators WHERE user_id = $1', [user.id]);
            if (opCheck.rows.length === 0) {
                await db.query(
                    "INSERT INTO operators (user_id, category, bio, photos, is_online, rating) VALUES ($1, 'Genel', 'Merhaba!', '{}', false, 5.0)",
                    [user.id]
                );
                console.log(`✅ Operator profile created locally for kadin user: ${user.username}`);
            }
        }

    } catch (err) {
        console.error('Error during local migration:', err.message);
    } finally {
        process.exit();
    }
}

run();
