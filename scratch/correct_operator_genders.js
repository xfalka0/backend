const { Client } = require('pg');

const productionConnectionString = 'postgres://dating_user:Tog402dM1xT3K6FidYqTq6N7D1K1I4I3@dpg-cv5hbeogph6c73dg0t1g-a.frankfurt-postgres.render.com/dating_eexy';

async function run() {
    console.log('--- CONNECTING TO PRODUCTION RENDER DB (dating_eexy) ---');
    const client = new Client({
        connectionString: productionConnectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to Render DB successfully!\n');

        const idsToFix = [41, 44, 51]; // Beren, Cemre, Fadimenur

        // 1. Show current details
        console.log('--- Current Details Before Correction ---');
        const beforeRes = await client.query('SELECT id, username, display_name, gender, role FROM users WHERE id IN (41, 44, 51)');
        console.table(beforeRes.rows);

        // 2. Perform the update
        console.log('\n--- Correcting Genders to "kadin" ---');
        const fixRes = await client.query("UPDATE users SET gender = 'kadin' WHERE id IN (41, 44, 51) RETURNING id, username, display_name, gender");
        console.log(`Updated ${fixRes.rowCount} users successfully.`);
        console.table(fixRes.rows);

        // 3. Let's do a double check of any other female operators that might have been affected
        console.log('\n--- Double Checking all Active Operators ---');
        const operatorsRes = await client.query(`
            SELECT u.id, u.username, u.display_name, u.gender, u.role
            FROM users u
            JOIN operators o ON u.id::text = o.user_id::text
            WHERE u.account_status = 'active'
        `);
        console.table(operatorsRes.rows);

    } catch (err) {
        console.error('Error during execution:', err.message);
    } finally {
        await client.end();
        console.log('\n--- Disconnected from DB ---');
    }
}

run();
