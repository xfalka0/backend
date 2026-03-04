const pool = require('./db');

async function testBoost() {
    try {
        console.log("Starting transaction...");
        await pool.query('BEGIN');

        // This is exactly what boosts.js does
        const userId = 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b';
        const cost = 10;
        const durationMinutes = 1440;

        console.log("1. Deducting balance...");
        await pool.query(`
            UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING balance
        `, [cost, userId]);

        console.log("2. Inserting transaction...");
        await pool.query(`
            INSERT INTO transactions (user_id, amount, type, description) 
            VALUES ($1, $2, $3, $4)
        `, [userId, -cost, 'spend_boost', 'Profil Öne Çıkarma (Boost)']);

        console.log("3. Inserting boost...");
        await pool.query(`
            INSERT INTO boosts (user_id, start_time, end_time) 
            VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + ($2 * interval '1 minute'))
            RETURNING end_time
        `, [userId, durationMinutes]);

        await pool.query('ROLLBACK');
        console.log("SUCCESS");
    } catch (error) {
        console.error("DB ERROR: ", error);
        await pool.query('ROLLBACK');
    } finally {
        process.exit();
    }
}
testBoost();
