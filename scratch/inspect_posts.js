const db = require('../db');

async function main() {
    try {
        console.log('--- USERS IN DB ---');
        const users = await db.query('SELECT id, display_name, username, gender, role, vip_level FROM users');
        console.table(users.rows);

        console.log('--- POSTS IN DB ---');
        const posts = await db.query(`
            SELECT p.id, p.operator_id, p.image_url, p.content, u.display_name, u.gender, u.role
            FROM posts p
            JOIN users u ON p.operator_id = u.id
        `);
        console.table(posts.rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
