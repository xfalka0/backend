const { Client } = require('pg');

const productionConnectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function verifyQuery() {
    const client = new Client({
        connectionString: productionConnectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to Render DB successfully!\n');

        const userId = 421; // affiliate1 user ID

        const earningsRes = await client.query(`
            SELECT 
                COALESCE(SUM(p.amount * 0.2), 0) as total_earnings,
                COALESCE(SUM(CASE WHEN p.created_at >= CURRENT_DATE THEN p.amount * 0.2 ELSE 0 END), 0) as earnings_today
            FROM payments p
            JOIN users u ON p.user_id = u.id
            WHERE u.referred_by::text = $1::text AND p.status = 'completed'
        `, [userId.toString()]);

        console.log('--- UPDATED EARNINGS QUERY RESULTS ---');
        console.log(`Total Earnings: ${parseFloat(earningsRes.rows[0].total_earnings).toFixed(2)} TL`);
        console.log(`Earnings Today: ${parseFloat(earningsRes.rows[0].earnings_today).toFixed(2)} TL`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

verifyQuery();
