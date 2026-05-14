const db = require('../db');
const { MALE_NAMES_ARRAY } = require('../utils/helpers');

async function fixGenders() {
    console.log('--- Starting Gender Fix Task ---');
    try {
        let maleCount = 0;
        let femaleCount = 0;

        // 1. Array-based ILIKE ANY Fix (Most powerful)
        console.log('Running Name Array Fix...');
        const patterns = MALE_NAMES_ARRAY.map(name => `%${name}%`);
        const regexFix = await db.query(
            `UPDATE users 
             SET gender = 'erkek' 
             WHERE gender != 'erkek' 
               AND gender != 'coin_bayisi'
               AND translate(LOWER(COALESCE(display_name, '') || ' ' || COALESCE(name, '') || ' ' || COALESCE(username, '')), 'çğıöşüİ', 'cgiosui') ILIKE ANY($1)`,
            [patterns]
        );
        maleCount += regexFix.rowCount;
        console.log(`Array fix updated ${regexFix.rowCount} users.`);

        console.log('--- Gender Fix Summary ---');
        console.log(`Total Males Fixed/Confirmed: ${maleCount}`);
        console.log('--- Task Completed ---');
        
        process.exit(0);
    } catch (err) {
        console.error('Error during gender fix:', err);
        process.exit(1);
    }
}

fixGenders();
