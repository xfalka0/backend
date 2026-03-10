const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to Render DB successfully!');

        const updates = [
            { id: 'coins_100_v1', oldId: 'coins-100-v1' },
            { id: 'coins_200_v1', oldId: 'coins-200-v1' },
            { id: 'coins_400_v1', oldId: 'coins-400-v1' },
            { id: 'coins_700_v1', oldId: 'coins-700-v1' },
            { id: 'coins_1200_v1', oldId: 'coins-1200-v1' },
            { id: 'coins_2500_v1', oldId: 'coins-2500-v1' },
            { id: 'coins_5000_v1', oldId: 'coins-5000-v1' }
        ];

        for (let up of updates) {
            await client.query("UPDATE coin_packages SET revenuecat_id = $1 WHERE revenuecat_id = $2", [up.id, up.oldId]);
        }

        console.log('RevenueCat IDs REVERTED to use underscores.');

        const finalState = await client.query('SELECT coins, revenuecat_id FROM coin_packages ORDER BY coins ASC');
        console.log('FINAL STATE:', finalState.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
