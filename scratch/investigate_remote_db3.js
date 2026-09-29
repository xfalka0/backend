const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const query1 = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN password_hash IS NULL THEN 1 ELSE 0 END) as no_password_count,
                SUM(CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END) as has_password_count
            FROM users 
            WHERE gender = 'kadin'
        `;
        const res1 = await pool.query(query1);
        console.log(res1.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
