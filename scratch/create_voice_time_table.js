const db = require('../db');

async function run() {
    try {
        console.log('Creating user_daily_voice_time table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_daily_voice_time (
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                date DATE DEFAULT CURRENT_DATE,
                duration_seconds INT DEFAULT 0,
                xp_stage INT DEFAULT 0,
                PRIMARY KEY (user_id, date)
            );
        `);
        console.log('user_daily_voice_time table created successfully!');
    } catch (err) {
        console.error('Error creating table:', err);
    } finally {
        process.exit();
    }
}

run();
