const { Client } = require('pg');

async function createDatabase() {
    const client = new Client({
        user: 'postgres',
        host: 'localhost',
        password: '123', // I'll have to ask the user if this fails
        port: 5432,
        database: 'postgres' // Connect to default DB first
    });

    try {
        await client.connect();
        console.log('Connected to postgres superuser DB');

        // Check if Dating DB exists
        const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'dating'");
        if (res.rowCount === 0) {
            console.log('Creating "dating" database...');
            await client.query('CREATE DATABASE dating');
            console.log('Database created successfully');
        } else {
            console.log('Database "dating" already exists');
        }
    } catch (err) {
        console.error('Database Creation Error:', err.message);
        if (err.message.includes('authentication failed')) {
            console.log('PLEASE_ASK_USER_FOR_PASSWORD');
        }
    } finally {
        await client.end();
    }
}

createDatabase();
