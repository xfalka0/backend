const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to Render DB!');

        const identifier = 'furkandn011@gmail.com';
        const code = '511698';

        console.log(`Testing verification for ${identifier} with code ${code}...`);
        
        // 1. Raw fetch
        const rawRes = await client.query('SELECT * FROM otps WHERE identifier = $1', [identifier]);
        console.log('Raw row in DB:', rawRes.rows[0]);

        // 2. Query with expires_at > NOW()
        const resNow = await client.query(
            'SELECT * FROM otps WHERE identifier = $1 AND otp_code = $2 AND expires_at > NOW()',
            [identifier, code]
        );
        console.log('Result using NOW():', resNow.rows.length > 0 ? 'MATCHED' : 'EXPIRED/NO MATCH');

        // 3. Query with expires_at > $3 (our new fix)
        const resDate = await client.query(
            'SELECT * FROM otps WHERE identifier = $1 AND otp_code = $2 AND expires_at > $3',
            [identifier, code, new Date()]
        );
        console.log('Result using JS new Date():', resDate.rows.length > 0 ? 'MATCHED' : 'EXPIRED/NO MATCH');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
