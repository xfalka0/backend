const db = require('../db');

async function checkTables() {
    try {
        console.log('--- USERS ---');
        const users = await db.query('SELECT id, username, coin_balance, balance, role, account_status FROM users');
        console.log(JSON.stringify(users.rows, null, 2));

        console.log('--- GIFTS ---');
        const gifts = await db.query('SELECT id, name, cost FROM gifts');
        console.log(JSON.stringify(gifts.rows, null, 2));

        console.log('--- PARTY ROOMS ---');
        const rooms = await db.query('SELECT * FROM party_rooms');
        console.log(JSON.stringify(rooms.rows, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkTables();
