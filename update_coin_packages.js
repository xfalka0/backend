const db = require('./db');

async function updateCoinPackagesTable() {
    try {
        console.log('Adding missing columns to coin_packages...');
        await db.query(`
            ALTER TABLE coin_packages 
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS revenuecat_id VARCHAR(100),
            ADD COLUMN IF NOT EXISTS description TEXT;
        `);
        console.log('Successfully updated coin_packages table.');

        const res = await db.query('SELECT * FROM coin_packages');
        console.log('Current packages:', res.rows);

    } catch (err) {
        console.error('Error updating table:', err);
    } finally {
        process.exit();
    }
}

updateCoinPackagesTable();
