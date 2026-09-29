const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("=== ADIM 0: ÖLÇÜM ===");
        const q = `
            SELECT 
                CASE WHEN password_hash IS NULL THEN 'Google/Social' ELSE 'Email/Phone' END as auth_type,
                gender,
                COUNT(*) as count
            FROM users
            GROUP BY auth_type, gender
            ORDER BY auth_type, count DESC
        `;
        const res = await pool.query(q);
        console.table(res.rows);

        // Calculate percentages
        const totalByAuth = {};
        res.rows.forEach(r => {
            totalByAuth[r.auth_type] = (totalByAuth[r.auth_type] || 0) + parseInt(r.count);
        });

        const withPercentages = res.rows.map(r => ({
            auth_type: r.auth_type,
            gender: r.gender,
            count: r.count,
            percentage: ((parseInt(r.count) / totalByAuth[r.auth_type]) * 100).toFixed(2) + '%'
        }));
        
        console.log("\\n--- Yüzdelik Dağılım ---");
        console.table(withPercentages);
        
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
