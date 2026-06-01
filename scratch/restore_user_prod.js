const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function run() {
    console.log('--- CONNECTING TO PRODUCTION RENDER DB (dating_db_j6yd) ---');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        // Start Transaction
        await client.query('BEGIN');

        // 1. Verify user 594 exists and is the duplicate un-onboarded user
        const checkDuplicateRes = await client.query('SELECT id, username, email, onboarding_completed FROM users WHERE id = 594');
        if (checkDuplicateRes.rows.length > 0) {
            const dupUser = checkDuplicateRes.rows[0];
            console.log('Found duplicate user to delete:', dupUser);
            
            // Delete user 594
            await client.query('DELETE FROM users WHERE id = 594');
            console.log('Successfully deleted duplicate user 594.');
        } else {
            console.log('Duplicate user 594 not found or already deleted.');
        }

        // 2. Update user 591 email back to furkandn012@gmail.com
        const checkCorrectRes = await client.query('SELECT id, username, email FROM users WHERE id = 591');
        if (checkCorrectRes.rows.length > 0) {
            const correctUser = checkCorrectRes.rows[0];
            console.log('Found correct operator user:', correctUser);

            await client.query("UPDATE users SET email = 'furkandn012@gmail.com' WHERE id = 591");
            console.log("Successfully restored user 591 email to 'furkandn012@gmail.com'.");
        } else {
            console.log('Error: Correct user 591 not found in database!');
        }

        // Commit Transaction
        await client.query('COMMIT');
        console.log('Transaction committed successfully!');

        // 3. Final Verification
        console.log('--- FINAL STATE IN DATABASE ---');
        const finalRes = await client.query("SELECT id, username, email, display_name, role, gender, onboarding_completed, balance FROM users WHERE id = 591");
        console.table(finalRes.rows);

    } catch (err) {
        console.error('Error occurred, rolling back:', err.message);
        await client.query('ROLLBACK');
    } finally {
        await client.end();
    }
}

run();
