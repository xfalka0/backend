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

        // Query DB current time and timezone
        const timeRes = await client.query('SELECT NOW() as db_now, CURRENT_SETTING(\'TIMEZONE\') as db_tz');
        console.log('DB CURRENT TIME & TZ:', timeRes.rows[0]);

        // Query stored OTP codes
        const otpsRes = await client.query('SELECT * FROM otps ORDER BY created_at DESC LIMIT 5');
        console.log('\nLAST 5 STORED OTPS:');
        otpsRes.rows.forEach(row => {
            console.log(`- Identifier: ${row.identifier} | Code: ${row.otp_code} | Expires At: ${row.expires_at} | Created At: ${row.created_at}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
