const { Client } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';

async function run() {
    console.log('--- CONNECTING TO PRODUCTION RENDER DB (dating_db_j6yd) ---');
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully!');

        // List tables
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('Tables in database:');
        console.table(tablesRes.rows);

        // Print columns of messages table
        const msgCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'messages'
        `);
        console.log('Messages Table Columns:');
        console.log(msgCols.rows.map(r => r.column_name).join(', '));

        // Print columns of operators table
        const opCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'operators'
        `);
        console.log('Operators Table Columns:');
        console.log(opCols.rows.map(r => r.column_name).join(', '));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
