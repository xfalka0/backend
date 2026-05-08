const pool = require('../db');

async function checkUsers() {
    try {
        const res = await pool.query(`
            SELECT id, username, display_name, gender, role 
            FROM users 
            WHERE display_name ILIKE '%Furkan%' 
               OR display_name ILIKE '%Ramazan%'
               OR username ILIKE '%Furkan%'
               OR username ILIKE '%Ramazan%'
            LIMIT 10
        `);
        console.log('User Gender Check:');
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUsers();
