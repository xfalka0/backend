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

        // 1. Alter Table
        console.log('Adding missing columns...');
        await client.query(`
            ALTER TABLE coin_packages 
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS revenuecat_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS description TEXT;
        `);
        console.log('Columns added.');

        // 2. Fetch existing packages to verify their IDs before updating
        const current = await client.query('SELECT * FROM coin_packages ORDER BY coins ASC');
        if (current.rows.length === 0) {
            console.log('No packages exist, creating them...');
            // Insert the packages
            const newPackages = [
                { coins: 100, price: 49.99, name: 'Başlangıç Paketi', revenuecat_id: 'coins_100_v1' },
                { coins: 200, price: 89.99, name: 'Gümüş Paket', revenuecat_id: 'coins_200_v1' },
                { coins: 400, price: 159.99, name: 'Altın Paket', revenuecat_id: 'coins_400_v1' },
                { coins: 700, price: 299.99, name: 'VIP Paket', revenuecat_id: 'coins_700_v1' },
                { coins: 1200, price: 549.99, name: 'Platin Paket', revenuecat_id: 'coins_1200_v1' },
                { coins: 2500, price: 1149.99, name: 'Efsane Paket', revenuecat_id: 'coins_2500_v1' },
                { coins: 5000, price: 2099.99, name: 'Ultimate Paket', revenuecat_id: 'coins_5000_v1' }
            ];
            for (let pkg of newPackages) {
                await client.query(
                    'INSERT INTO coin_packages (name, coins, price, revenuecat_id, is_active) VALUES ($1, $2, $3, $4, true)',
                    [pkg.name, pkg.coins, pkg.price, pkg.revenuecat_id]
                );
            }
            console.log('Inserted default packages.');
        } else {
            console.log('Found existing packages. Updating prices and details...');
            // Need to map our new pricing logic to existing rows by matching 'coins' or ID.
            const updates = [
                { coins: 100, price: 49.99 },
                { coins: 200, price: 89.99 },
                { coins: 400, price: 159.99 },
                { coins: 700, price: 299.99 },
                { coins: 1200, price: 549.99 },
                { coins: 2500, price: 1149.99 },
                { coins: 5000, price: 2099.99 }
            ];

            for (let up of updates) {
                await client.query("UPDATE coin_packages SET price = $1, is_active = true WHERE coins = $2", [up.price, up.coins]);
            }
            console.log('Prices updated successfully!');
        }

        const finalState = await client.query('SELECT * FROM coin_packages ORDER BY coins ASC');
        console.log('FINAL STATE:', finalState.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
