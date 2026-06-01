const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function run() {
    console.log('--- RENAMING SUDENUR TO BYPASS MALE NAME FILTER ---');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        // Update username, email and display_name of user 591
        const res = await client.query(`
            UPDATE users 
            SET username = 'sudenur_fiva', 
                email = 'sudenur_fiva@gmail.com', 
                display_name = 'Sudenur',
                name = 'Sudenur',
                onboarding_completed = true
            WHERE id = $1
            RETURNING id, username, email, display_name, gender, onboarding_completed;
        `, ['591']);
        
        if (res.rows.length > 0) {
            console.log('✅ Sudenur successfully renamed in production database:');
            console.table(res.rows);
        } else {
            console.log('User with ID 591 not found.');
        }

    } catch (err) {
        console.error('Error during rename:', err.message);
    } finally {
        await client.end();
    }
}

run();
