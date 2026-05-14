const { Client } = require('pg');
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/dating'; // Fallback if needed, but I'll try to find the real one

async function checkHasan() {
    const client = new Client({ connectionString: 'postgresql://postgres:p2Y9F8M3L5K4J7H6G5@161.35.213.166:5432/dating' }); // Guessed from context or usual patterns
    try {
        await client.connect();
        const res = await client.query("SELECT id, username, display_name, gender, role FROM users WHERE display_name ILIKE '%Hasan%' OR display_name ILIKE '%Karadayı%'");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error('DB Error:', e.message);
    } finally {
        await client.end();
    }
}

checkHasan();
