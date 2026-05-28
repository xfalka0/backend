const db = require('../db');
const { Client } = require('pg');

const productionConnectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function updateLocalDB() {
    console.log('--- UPDATING LOCAL DATABASE ---');
    try {
        const res = await db.query('SELECT * FROM coin_packages ORDER BY coins ASC');
        for (let row of res.rows) {
            const currentPrice = parseFloat(row.price);
            let newPrice = currentPrice * 1.10;
            newPrice = Math.floor(newPrice) + 0.99;
            console.log(`Local DB - ID: ${row.id} | Coins: ${row.coins} | Old Price: ${currentPrice} ₺ -> New Price: ${newPrice} ₺`);
            await db.query('UPDATE coin_packages SET price = $1 WHERE id = $2', [newPrice, row.id]);
        }
        console.log('Local DB successfully updated!');
    } catch (err) {
        console.error('Error updating local DB:', err);
    }
}

async function updateProductionDB() {
    console.log('\n--- UPDATING PRODUCTION (RENDER) DATABASE ---');
    const client = new Client({
        connectionString: productionConnectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to Render DB successfully!');
        
        const res = await client.query('SELECT * FROM coin_packages ORDER BY coins ASC');
        for (let row of res.rows) {
            const currentPrice = parseFloat(row.price);
            let newPrice = currentPrice * 1.10;
            newPrice = Math.floor(newPrice) + 0.99;
            console.log(`Render DB - ID: ${row.id} | Coins: ${row.coins} | Old Price: ${currentPrice} ₺ -> New Price: ${newPrice} ₺`);
            await client.query('UPDATE coin_packages SET price = $1 WHERE id = $2', [newPrice, row.id]);
        }
        console.log('Render DB successfully updated!');
    } catch (err) {
        console.error('Error updating Render DB:', err);
    } finally {
        await client.end();
    }
}

async function main() {
    await updateLocalDB();
    await updateProductionDB();
    console.log('\nAll databases updated!');
    process.exit(0);
}

main();
