const db = require('../db');

async function inspectMaleUsers() {
    try {
        const query = `
            SELECT id, username, display_name, name, gender, role, age, boy, created_at 
            FROM users 
            WHERE display_name ILIKE '%Sedat%' 
               OR display_name ILIKE '%Bilal%' 
               OR display_name ILIKE '%İzzet%' 
               OR display_name ILIKE '%Suat%' 
               OR display_name ILIKE '%Alpaslan%'
               OR display_name ILIKE '%Genel%'
               OR username ILIKE '%Sedat%'
               OR username ILIKE '%Bilal%'
        `;
        const res = await db.query(query);
        console.log('--- DATABASE USER GENDER RECORDS ---');
        console.table(res.rows);

        // Also check default fallback values for null or unexpected genders
        const nullOrStrangeGenders = await db.query(`
            SELECT id, display_name, name, gender, role
            FROM users
            WHERE gender IS NULL OR gender NOT IN ('erkek', 'kadin', 'coin_bayisi', 'male', 'female')
            LIMIT 10
        `);
        console.log('--- NULL OR STRANGE GENDERS IN DB ---');
        console.table(nullOrStrangeGenders.rows);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

inspectMaleUsers();
