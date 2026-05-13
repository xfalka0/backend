const db = require('../db');

async function checkAllPhotos() {
    try {
        const res = await db.query("SELECT id, username, photos FROM users");
        const withPhotos = res.rows.filter(r => r.photos && r.photos.length > 0);
        console.log('Users with photos count:', withPhotos.length);
        if (withPhotos.length > 0) {
            console.log('Samples:', JSON.stringify(withPhotos.slice(0, 3), null, 2));
        }

        const res2 = await db.query("SELECT * FROM pending_photos");
        console.log('Pending photos count:', res2.rows.length);
        if (res2.rows.length > 0) {
            console.log('Samples pending:', JSON.stringify(res2.rows.slice(0, 3), null, 2));
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkAllPhotos();
