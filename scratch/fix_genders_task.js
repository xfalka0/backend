const db = require('../db');
const { MALE_NAME_PATTERN } = require('../utils/helpers');

async function fixGenders() {
    console.log('--- Starting Gender Fix Task ---');
    try {
        const MALE_NAMES = ['Mustafa', 'Furkan', 'Ahmet', 'Mehmet', 'Ali', 'Veli', 'Can', 'Murat', 'Hakan', 'Emre', 'Burak', 'Volkan', 'Gökhan', 'Serkan', 'Ömer', 'Osman', 'İbrahim', 'Halil', 'Ramadan', 'Ramazan', 'Fırat', 'Mert', 'Yiğit', 'Arda', 'Şahin', 'Serdal', 'Nevzat', 'Cevat', 'Aziz', 'Yaşar', 'Nusret'];
        const FEMALE_NAMES = ['Ayşe', 'Fatma', 'Su', 'Esma', 'Emriye', 'Zeynep', 'Elif', 'Merve', 'Selin', 'Ece', 'Aslı', 'Deniz', 'Güneş', 'Buse', 'Hazal', 'Simge', 'İrem', 'Ceren', 'Dilara', 'Bahar', 'Sibel', 'Arzu', 'Hülya', 'Pınar', 'Demet'];

        let maleCount = 0;
        let femaleCount = 0;

        // 1. Regex Fix (Most powerful)
        console.log('Running Regex Pattern Fix...');
        const regexFix = await db.query(
            `UPDATE users 
             SET gender = 'erkek' 
             WHERE gender != 'erkek' 
               AND gender != 'coin_bayisi'
               AND translate(LOWER(COALESCE(display_name, '') || ' ' || COALESCE(name, '') || ' ' || COALESCE(username, '')), 'çğıöşüİ', 'cgiosui') ~* $1`,
            [MALE_NAME_PATTERN]
        );
        maleCount += regexFix.rowCount;
        console.log(`Regex fix updated ${regexFix.rowCount} users.`);

        // 2. Individual Name Fixes (Male)
        for (const name of MALE_NAMES) {
            const r = await db.query(
                "UPDATE users SET gender = 'erkek' WHERE (display_name ILIKE $1 OR username ILIKE $1) AND gender != 'erkek' AND gender != 'coin_bayisi'",
                [`%${name}%`]
            );
            maleCount += r.rowCount;
        }

        // 3. Individual Name Fixes (Female)
        for (const name of FEMALE_NAMES) {
            const r = await db.query(
                "UPDATE users SET gender = 'kadin' WHERE (display_name ILIKE $1 OR username ILIKE $1) AND gender != 'kadin' AND gender != 'coin_bayisi'",
                [`%${name}%`]
            );
            femaleCount += r.rowCount;
        }

        console.log('--- Gender Fix Summary ---');
        console.log(`Total Males Fixed/Confirmed: ${maleCount}`);
        console.log(`Total Females Fixed/Confirmed: ${femaleCount}`);
        console.log('--- Task Completed ---');
        
        process.exit(0);
    } catch (err) {
        console.error('Error during gender fix:', err);
        process.exit(1);
    }
}

fixGenders();
