const db = require('../db');
const fs = require('fs');
const path = require('path');

async function run() {
    try {
        console.log('Running SQL Migration on Local Database...');
        const sqlFilePath = path.join(__dirname, '../migrations/create_family_tables.sql');
        const sql = fs.readFileSync(sqlFilePath, 'utf8');
        await db.query(sql);
        console.log('Family tables verified/created.');

        console.log('Creating user_daily_voice_time table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_daily_voice_time (
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                date DATE DEFAULT CURRENT_DATE,
                duration_seconds INT DEFAULT 0,
                xp_stage INT DEFAULT 0,
                PRIMARY KEY (user_id, date)
            );
        `);
        console.log('user_daily_voice_time table verified/created.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

run();
