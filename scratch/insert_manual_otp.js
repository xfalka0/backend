const { Client } = require('c:/Users/Falka/Desktop/dating/backend/node_modules/pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        await client.query('BEGIN');

        const email = 'furkandn012@gmail.com';
        const code = '112233'; // Easy manual code
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

        console.log(`Inserting manual OTP '${code}' for '${email}'...`);

        // Delete any existing codes
        await client.query('DELETE FROM otps WHERE identifier = $1', [email]);

        // Insert new code using correct column name 'otp_code'
        await client.query(
            'INSERT INTO otps (identifier, otp_code, expires_at) VALUES ($1, $2, $3)',
            [email, code, expires]
        );

        await client.query('COMMIT');
        console.log('Transaction committed successfully! Manual OTP code is active.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
