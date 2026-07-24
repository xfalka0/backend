const db = require('../db');

async function main() {
    const res = await db.query(`
        SELECT u.id, u.display_name, u.gender, u.role, u.account_status, o.user_id as op_user_id
        FROM users u
        LEFT JOIN operators o ON u.id = o.user_id
        WHERE o.user_id IS NOT NULL OR u.role = 'operator'
    `);
    console.log("Total Operators in DB:", res.rows.length);
    console.log(res.rows);
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
