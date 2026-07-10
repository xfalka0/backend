const db = require('../db');

async function checkAvatars() {
    try {
        console.log("Checking specific users from the screenshot...");
        const res = await db.query(`
            SELECT u.id, u.username, u.display_name, u.avatar_url, o.photos 
            FROM users u 
            LEFT JOIN operators o ON u.id = o.user_id 
            WHERE u.display_name ILIKE ANY(ARRAY['%azro%', '%asya%', '%asiye%', '%ada%'])
            ORDER BY u.id DESC;
        `);
        
        console.log(JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkAvatars();
