const { Client } = require('pg');
require('dotenv').config({ path: '../.env' });

const client = new Client({
    connectionString: 'postgresql://postgres:123@localhost:5432/dating'
});

const MALE_NAMES = ['Mustafa', 'Furkan', 'Ahmet', 'Mehmet', 'Ali', 'Veli', 'Can', 'Murat', 'Hakan', 'Emre', 'Burak', 'Volkan', 'Gökhan', 'Serkan', 'Ömer', 'Osman', 'İbrahim', 'Halil', 'Ramadan', 'Ramazan'];
const FEMALE_NAMES = ['Ayşe', 'Fatma', 'Su', 'Esma', 'Emriye', 'Zeynep', 'Elif', 'Merve', 'Selin', 'Ece', 'Aslı', 'Deniz', 'Güneş', 'Buse', 'Hazal', 'Simge', 'İrem', 'Ceren'];

async function fixGenders() {
    try {
        await client.connect();
        
        console.log('--- Fixing Male Genders ---');
        for (const name of MALE_NAMES) {
            const res = await client.query(
                "UPDATE users SET gender = 'erkek' WHERE (display_name ILIKE $1 OR username ILIKE $1) AND gender != 'erkek' AND gender != 'coin_bayisi'",
                [`%${name}%`]
            );
            if (res.rowCount > 0) {
                console.log(`Updated ${res.rowCount} users for name: ${name}`);
            }
        }

        console.log('\n--- Fixing Female Genders ---');
        for (const name of FEMALE_NAMES) {
            const res = await client.query(
                "UPDATE users SET gender = 'kadin' WHERE (display_name ILIKE $1 OR username ILIKE $1) AND gender != 'kadin' AND gender != 'coin_bayisi'",
                [`%${name}%`]
            );
            if (res.rowCount > 0) {
                console.log(`Updated ${res.rowCount} users for name: ${name}`);
            }
        }

        console.log('\n--- Fixing Remaining Operators ---');
        // If an operator has a name that doesn't match, we can't be sure, 
        // but most operators are intended to be women in this app's context.
        // However, we shouldn't force it if they are already 'erkek'.

        const finalCheck = await client.query("SELECT username, display_name, gender FROM users WHERE role = 'operator' LIMIT 20");
        console.table(finalCheck.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

fixGenders();
