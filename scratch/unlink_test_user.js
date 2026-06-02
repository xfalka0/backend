const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function run() {
    console.log('--- UNLINKING TEST USER FROM AGENCY ---');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        // Unlink user sudenur_fiva (id: 591)
        const res = await client.query(`
            UPDATE users 
            SET agency_id = NULL 
            WHERE id = '591' OR email = 'furkandn012@gmail.com'
            RETURNING id, username, agency_id;
        `);
        console.table(res.rows);
        console.log('User successfully unlinked from agency! Now they can test entering a code on the phone.');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
