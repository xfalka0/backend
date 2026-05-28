const { Client } = require('pg');

const productionConnectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function updateProductionDB() {
    console.log('--- UPDATING PRODUCTION (RENDER) DATABASE WITH CUSTOM PRICES ---');
    const client = new Client({
        connectionString: productionConnectionString,
        ssl: { rejectUnauthorized: false }
    });

    const updates = [
        { coins: 100, price: 54.99 },
        { coins: 200, price: 98.99 },
        { coins: 400, price: 189.99 },
        { coins: 700, price: 334.99 },
        { coins: 1200, price: 604.99 },
        { coins: 2500, price: 1299.99 },
        { coins: 5000, price: 2399.99 }
    ];

    try {
        await client.connect();
        console.log('Connected to Render DB successfully!');
        
        for (let up of updates) {
            console.log(`Updating Render DB - Coins: ${up.coins} -> Custom Price: ${up.price} ₺`);
            await client.query("UPDATE coin_packages SET price = $1, is_active = true WHERE coins = $2", [up.price, up.coins]);
        }
        console.log('Render DB successfully updated with custom prices!');
        
        const finalState = await client.query('SELECT coins, price FROM coin_packages ORDER BY coins ASC');
        console.log('FINAL STATE IN CANLI DB:', finalState.rows);
    } catch (err) {
        console.error('Error updating Render DB:', err);
    } finally {
        await client.end();
        process.exit(0);
    }
}

updateProductionDB();
