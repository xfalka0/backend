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

        const compRes = await client.query(
            'SELECT expires_at::text as expires_str, NOW()::text as now_str, (expires_at > NOW()) as comp FROM otps WHERE identifier = $1 AND otp_code = $2',
            [identifier, code]
        );
        console.log('Comparison Results (AS TEXT):', compRes.rows[0]);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
