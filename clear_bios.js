const { Pool } = require('pg'); 
const pool = new Pool({ connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true' }); 
pool.query("UPDATE users SET bio = NULL WHERE bio LIKE '%Buraya%'").then(res => { 
    console.log('Updated:', res.rowCount); 
    pool.end(); 
}).catch(console.error);
