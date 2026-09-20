require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        const query = `UPDATE users 
             SET display_name = COALESCE($1, display_name), 
                 name = COALESCE($1, name),
                 bio = COALESCE($2, bio), 
                 job = COALESCE($3, job), 
                 relationship = COALESCE($4, relationship), 
                 zodiac = COALESCE($5, zodiac), 
                 interests = COALESCE($6, interests),
                 age = COALESCE($7, age),
                 edu = COALESCE($8, edu),
                 boy = COALESCE($9, boy),
                 kilo = COALESCE($10, kilo),
                 city = COALESCE($11, city)
             WHERE id = $12 
             RETURNING *`;
             
        const params = [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'Ankara', 43];
        
        console.log("Running query with undefineds...");
        const res = await pool.query(query, params);
        console.log("DB returned city:", res.rows[0].city);
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
