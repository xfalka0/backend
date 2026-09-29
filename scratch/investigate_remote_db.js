const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("=== 1.a) Bu profilin ve test ettiğim erkek hesabın gender, role ve bayi... ===");
        const res1 = await pool.query(`
            SELECT id, display_name, username, gender, role 
            FROM users 
            WHERE display_name IN ('SÜL', 'Sezer', 'Berkay Deniz', 'dursun') 
               OR username IN ('sül', 'sezer', 'berkay deniz', 'dursun', 'sul', 'berkaydeniz')
        `);
        console.table(res1.rows);

        console.log("\n=== 1.b) Cinsiyet kolonundaki tüm farklı değerler ve sayıları ===");
        const res2 = await pool.query(`SELECT gender, COUNT(*) FROM users GROUP BY gender`);
        console.table(res2.rows);

        console.log("\n=== 1.c) coin_bayisi olarak işaretli profillerin sayısı ve gender değerlerinin dağılımı ===");
        const res3 = await pool.query(`SELECT gender, role, COUNT(*) FROM users WHERE gender = 'coin_bayisi' OR role = 'coin_bayisi' GROUP BY gender, role`);
        console.table(res3.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

run();
