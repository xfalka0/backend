const { Client } = require('pg');

const localConfig = {
    user: 'postgres',
    host: 'localhost',
    database: 'dating',
    password: '123',
    port: 5432
};

const renderConfig = {
    connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true',
    ssl: { rejectUnauthorized: false }
};

async function checkStatsColumns() {
    try {
        console.log('--- LOCAL DB: checking operator_stats ---');
        const localClient = new Client(localConfig);
        await localClient.connect();
        const localCols = await localClient.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'operator_stats'
        `);
        console.log('Local columns:', localCols.rows.map(r => r.column_name));
        await localClient.end();

        console.log('\n--- RENDER DB: checking operator_stats ---');
        const renderClient = new Client(renderConfig);
        await renderClient.connect();
        const renderCols = await renderClient.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'operator_stats'
        `);
        console.log('Render columns:', renderCols.rows.map(r => r.column_name));
        await renderClient.end();

    } catch (err) {
        console.error('Inspection failed:', err);
    }
}

checkStatsColumns();
