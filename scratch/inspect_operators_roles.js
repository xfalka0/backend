const db = require('../db');

async function run() {
    try {
        const query = `
            SELECT u.id, COALESCE(u.display_name, u.username) as name, u.role
            FROM users u
            JOIN operators o ON u.id::text = o.user_id::text
            WHERE u.account_status = 'active' AND u.role = 'operator'
        `;
        const res = await db.query(query);
        console.log('Returned profiles count with u.role = operator:', res.rows.length);
        console.log('All returned roles:', [...new Set(res.rows.map(r => r.role))]);
        console.log('Sample profiles:', res.rows.slice(0, 5));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}

run();
