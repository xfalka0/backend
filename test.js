require('dotenv').config();
const db = require('./db');
async function test() {
    try {
        const res = await db.query("SELECT COUNT(*) FROM users u WHERE (LOWER(u.gender) = 'kadin' OR u.gender = 'coin_bayisi') AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff') AND (u.gender_confirmed_at IS NOT NULL OR u.role = 'operator' OR u.gender = 'coin_bayisi')");
        console.log('Matches:', res.rows[0].count);
        const res2 = await db.query("SELECT COUNT(*) FROM users u WHERE (LOWER(u.gender) = 'kadin' OR u.gender = 'coin_bayisi') AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff')");
        console.log('Total without confirmation:', res2.rows[0].count);
    } catch(e) {
        console.error(e.message);
    }
    process.exit(0);
}
test();
