const db = require('../db');

async function debugSearch() {
    console.log('--- Search all users for male names ---');
    // Using a simpler query to find ANYONE with a male name who is marked as 'kadin'
    const res = await db.query(
        "SELECT id, username, display_name, gender, role FROM users WHERE gender = 'kadin' AND (LOWER(display_name) ~ 'izzet|bilal|ibrahim|alpaslan|faysal|sefer|suha')"
    );
    console.log('Found misclassified:', JSON.stringify(res.rows, null, 2));
    process.exit(0);
}

debugSearch();
