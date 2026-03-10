const db = require('./db');
db.query("SELECT id, display_name FROM users WHERE display_name = 'FS Coin Bayi' LIMIT 1")
    .then(r => {
        if (r.rows.length > 0) {
            console.log(r.rows[0].id);
        } else {
            console.log('NOT_FOUND');
        }
        process.exit(0);
    })
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
