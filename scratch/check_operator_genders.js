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

        // Query users matching Fadimenur, Cemre, Beren
        const res = await client.query(`
            SELECT id, username, email, display_name, role, gender, onboarding_completed, created_at 
            FROM users 
            WHERE display_name ILIKE '%Fadimenur%' 
               OR display_name ILIKE '%Cemre%' 
               OR display_name ILIKE '%Beren%'
               OR username ILIKE '%Fadimenur%' 
               OR username ILIKE '%Cemre%' 
               OR username ILIKE '%Beren%';
        `);
        console.log('\nOperator User Records in Database:');
        console.table(res.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
