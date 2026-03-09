const { Client } = require('pg');
const connectionString = 'postgresql://falkatech:Naber123@dating-db.c7m0wqkscid4.eu-central-1.rds.amazonaws.com:5432/postgres';

async function check() {
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Find specific problematic users
        const names = ['Berna', 'Beren Gürsoy', 'belinaays'];
        const res = await client.query(`
            SELECT u.id, u.username, u.display_name, u.avatar_url, o.photos 
            FROM users u 
            JOIN operators o ON u.id = o.user_id 
            WHERE u.display_name IN ($1, $2, $3) OR u.username IN ($1, $2, $3)
        `, names);

        console.log('--- DIAGNOSTIC RESULTS (Problematic Users) ---');
        console.log(JSON.stringify(res.rows, null, 2));

        // Also check last 5 operators to see working examples
        const res2 = await client.query(`
            SELECT u.display_name, u.avatar_url, o.photos 
            FROM users u 
            JOIN operators o ON u.id = o.user_id 
            ORDER BY u.id DESC LIMIT 5
        `);
        console.log('--- DIAGNOSTIC RESULTS (Recent Operators) ---');
        console.log(JSON.stringify(res2.rows, null, 2));

        await client.end();
        process.exit(0);
    } catch (err) {
        console.error('Diagnostic error:', err);
        process.exit(1);
    }
}

check();
