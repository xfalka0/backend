const db = require('../db');
const { MALE_NAMES_ARRAY } = require('../utils/helpers');

async function fixUserGendersNow() {
    try {
        const malePattern = '\\y(' + MALE_NAMES_ARRAY.join('|') + ')\\y';
        console.log('[FIX] Updating male accounts using word-boundary regex...');
        const updateRes = await db.query(`
            UPDATE users 
            SET gender = 'erkek' 
            WHERE (
                LOWER(COALESCE(display_name, '')) ~* $1
                OR LOWER(COALESCE(name, '')) ~* $1
                OR LOWER(COALESCE(username, '')) ~* $1
            ) AND (gender IS NULL OR LOWER(gender) != 'erkek') AND gender != 'coin_bayisi'
            RETURNING id, display_name, username, gender
        `, [malePattern]);

        console.log(`[FIX] Successfully updated ${updateRes.rowCount} male accounts to gender = 'erkek'!`);
        console.table(updateRes.rows);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

fixUserGendersNow();
