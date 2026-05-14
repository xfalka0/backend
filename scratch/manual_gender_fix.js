const { Client } = require('pg');
// Production DB string from environment or usual pattern
const connectionString = 'postgresql://postgres:p2Y9F8M3L5K4J7H6G5@161.35.213.166:5432/dating';

async function fixGenders() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to DB. Fixing genders...');
        
        const maleNames = ['Hasan', 'İhsan', 'Karadayı', 'Yusuf', 'Zafer', 'Mgelvg', 'fatih', 'ahmet', 'mehmet', 'mustafa'];
        for (const name of maleNames) {
            const res = await client.query(
                "UPDATE users SET gender = 'erkek' WHERE (display_name ILIKE $1 OR username ILIKE $1) AND gender != 'erkek'",
                [`%${name}%`]
            );
            console.log(`Fixed ${res.rowCount} users for name: ${name}`);
        }
        
        console.log('Gender fix completed.');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await client.end();
    }
}

fixGenders();
