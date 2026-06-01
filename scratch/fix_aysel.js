const db = require('../db');

async function fixAysel() {
    try {
        console.log('Inspecting users with "demir" or "Aysel" in their names...');
        
        const res = await db.query(`
            SELECT id, username, display_name, gender, role 
            FROM users 
            WHERE display_name ILIKE '%Aysel%' 
               OR username ILIKE '%Aysel%'
               OR display_name ILIKE '%Fadimenur%'
               OR display_name ILIKE '%Cemre%'
               OR display_name ILIKE '%Beren%'
        `);

        console.log(`Found ${res.rows.length} matching users:`);
        res.rows.forEach(r => {
            console.log(`- ID: ${r.id}, Name: ${r.display_name}, Username: ${r.username}, Gender: ${r.gender}, Role: ${r.role}`);
        });

        // Restore Aysel Demir's gender to 'kadin'
        console.log('\nRestoring "Aysel demir" gender to "kadin"...');
        const updateRes = await db.query(`
            UPDATE users 
            SET gender = 'kadin' 
            WHERE (display_name ILIKE '%Aysel%' OR username ILIKE '%Aysel%')
              AND gender != 'kadin'
            RETURNING id, display_name, gender
        `);
        
        if (updateRes.rows.length > 0) {
            console.log('Success! Updated users:');
            updateRes.rows.forEach(r => {
                console.log(`- Name: ${r.display_name}, New Gender: ${r.gender}`);
            });
        } else {
            console.log('No users needed gender update (already kadin or not found).');
        }

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

fixAysel();
