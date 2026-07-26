const db = require('../db');

async function testGenderDiscovery() {
    try {
        console.log('--- Testing Male User Discovery (Expect Female users only) ---');
        const maleTarget = 'kadin';
        const maleQuery = `
            SELECT id, display_name, username, gender, role 
            FROM users u
            WHERE (LOWER(u.gender) = LOWER($1) OR u.gender = 'coin_bayisi' OR (LOWER($1) = 'kadin' AND LOWER(u.gender) IN ('kadin', 'kadın', 'female')) OR (LOWER($1) = 'erkek' AND LOWER(u.gender) IN ('erkek', 'male'))) 
              AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff')
            LIMIT 5
        `;
        const maleRes = await db.query(maleQuery, [maleTarget]);
        console.table(maleRes.rows);

        console.log('--- Testing Female User Discovery (Expect Male users only) ---');
        const femaleTarget = 'erkek';
        const femaleRes = await db.query(maleQuery, [femaleTarget]);
        console.table(femaleRes.rows);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

testGenderDiscovery();
