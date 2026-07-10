const db = require('../db');

async function checkDetails() {
    const query = `
        SELECT u.id, u.username, COALESCE(u.display_name, u.username) as name, u.gender, u.age, u.job, u.avatar_url, o.photos 
        FROM users u 
        LEFT JOIN operators o ON u.id = o.user_id 
        WHERE u.username IN ('dilek', 'Zeliha.d', 'İnci', 'Selenay', 'Hatice', 'Hande', 'Fatmanurrr', 'Esila 34', '『E』『L』『I』『F』', 'Ebrar')
           OR u.display_name IN ('dilek', 'Zeliha.d', 'İnci', 'Selenay', 'Hatice', 'Hande', 'Fatmanurrr', 'Esila 34', '『E』『L』『I』『F』', 'Ebrar')
    `;
    try {
        const res = await db.query(query);
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

checkDetails();
