const db = require('../db');
const { MALE_NAMES_ARRAY } = require('../utils/helpers');

async function fixUserGenders() {
    try {
        console.log('--- CHECKING MISCLASSIFIED MALE USERS IN DB ---');
        
        // Build regex pattern from MALE_NAMES_ARRAY
        const pattern = '\\y(' + MALE_NAMES_ARRAY.join('|') + ')\\y';

        const misclassified = await db.query(`
            SELECT id, display_name, name, username, gender, role 
            FROM users 
            WHERE (
                LOWER(COALESCE(display_name, '')) ~* $1
                OR LOWER(COALESCE(name, '')) ~* $1
                OR LOWER(COALESCE(username, '')) ~* $1
            ) AND (gender IS NULL OR LOWER(gender) != 'erkek')
        `, [pattern]);

        console.log(`Found ${misclassified.rows.length} misclassified male accounts with gender != 'erkek':`);
        console.table(misclassified.rows);

        if (misclassified.rows.length > 0) {
            console.log('--- CORRECTING MISCLASSIFIED MALE ACCOUNTS TO gender = \'erkek\' ---');
            const updateRes = await db.query(`
                UPDATE users 
                SET gender = 'erkek' 
                WHERE (
                    LOWER(COALESCE(display_name, '')) ~* $1
                    OR LOWER(COALESCE(name, '')) ~* $1
                    OR LOWER(COALESCE(username, '')) ~* $1
                ) AND (gender IS NULL OR LOWER(gender) != 'erkek')
                RETURNING id, display_name, username, gender
            `, [pattern]);
            console.log(`Successfully updated ${updateRes.rowCount} accounts to gender = 'erkek'!`);
            console.table(updateRes.rows);
        }

        process.exit(0);
    } catch (err) {
        console.error('Error fixing user genders:', err.message);
        process.exit(1);
    }
}

fixUserGenders();
