const { Client } = require('pg');

const productionConnectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function checkUserCoins() {
    const client = new Client({
        connectionString: productionConnectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to Render DB successfully!\n');

        // 1. Get user details
        const email = 'ygzberatduman54tk@gmail.com';
        const userRes = await client.query("SELECT id, username, email, balance, referred_by, created_at FROM users WHERE email = $1", [email]);
        
        if (userRes.rows.length === 0) {
            console.log(`❌ User ${email} not found.`);
            await client.end();
            return;
        }

        const user = userRes.rows[0];
        console.log('User Record:');
        console.log(user);
        console.log('\n-----------------------------------\n');

        // 2. Get user transactions
        const transRes = await client.query("SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC", [user.id]);
        console.log('User Transactions:');
        console.table(transRes.rows);

        // 3. Let's see some other recent users starting with 500 or 600
        console.log('\n--- RECENT USERS WITH COINS >= 500 ---');
        const recentHighCoins = await client.query("SELECT id, username, email, balance, referred_by, created_at FROM users ORDER BY created_at DESC LIMIT 20");
        console.table(recentHighCoins.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkUserCoins();
