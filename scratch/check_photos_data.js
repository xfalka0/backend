const db = require('../db');

async function checkUserPhotos() {
    try {
        const res = await db.query("SELECT id, username, photos FROM users WHERE photos IS NOT NULL AND array_length(photos, 1) > 0 LIMIT 5");
        console.log('Sample users with photos:', JSON.stringify(res.rows, null, 2));

        // Also check pending photos
        const resPending = await db.query("SELECT * FROM pending_photos WHERE status = 'pending' LIMIT 5");
        console.log('Sample pending photos:', JSON.stringify(resPending.rows, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUserPhotos();
