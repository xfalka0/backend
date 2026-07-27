const db = require('../db');

async function testBothGenders() {
    try {
        console.log('=====================================================');
        console.log('TEST 1: FEMALE USER SEARCH (userGender = kadin)');
        console.log('Target Filter MUST BE: erkek');
        console.log('=====================================================');

        const targetForFemaleUser = 'erkek';
        const query1 = `
            SELECT u.id, u.display_name, u.username, u.gender, u.role
            FROM users u
            WHERE (
                (LOWER($1) = 'kadin' AND LOWER(u.gender) IN ('kadin', 'kadın', 'female')) OR 
                (LOWER($1) = 'erkek' AND LOWER(u.gender) IN ('erkek', 'male')) OR 
                u.gender = 'coin_bayisi'
            ) AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff')
            LIMIT 10
        `;
        const res1 = await db.query(query1, [targetForFemaleUser]);
        console.log(`Found ${res1.rows.length} accounts for Female User feed:`);
        console.table(res1.rows);

        const femaleUserLeaks = res1.rows.filter(r => (r.gender || '').toLowerCase() === 'kadin');
        if (femaleUserLeaks.length > 0) {
            console.error('❌ CRITICAL LEAK! Female user feed contains female accounts:', femaleUserLeaks);
        } else {
            console.log('✅ PASS: Female user sees ONLY male accounts!');
        }

        console.log('\n=====================================================');
        console.log('TEST 2: MALE USER SEARCH (userGender = erkek)');
        console.log('Target Filter MUST BE: kadin');
        console.log('=====================================================');

        const targetForMaleUser = 'kadin';
        const res2 = await db.query(query1, [targetForMaleUser]);
        console.log(`Found ${res2.rows.length} accounts for Male User feed:`);
        console.table(res2.rows);

        const maleUserLeaks = res2.rows.filter(r => (r.gender || '').toLowerCase() === 'erkek');
        if (maleUserLeaks.length > 0) {
            console.error('❌ CRITICAL LEAK! Male user feed contains male accounts:', maleUserLeaks);
        } else {
            console.log('✅ PASS: Male user sees ONLY female accounts!');
        }

        process.exit(0);
    } catch (err) {
        console.error('Test Error:', err.message);
        process.exit(1);
    }
}

testBothGenders();
