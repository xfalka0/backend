const db = require('./db');

async function debugRaw() {
    try {
        console.log('--- DEBUGGING DB INSERTION ---');

        // 1. Check tables
        const postsCount = await db.query('SELECT COUNT(*) FROM posts');
        const storiesCount = await db.query('SELECT COUNT(*) FROM stories');
        console.log(`Current Posts: ${postsCount.rows[0].count}`);
        console.log(`Current Stories: ${storiesCount.rows[0].count}`);

        // 2. Find a valid operator
        const op = await db.query("SELECT id, username FROM users WHERE role = 'operator' LIMIT 1");
        if (op.rows.length === 0) {
            console.error('No operators found in DB! Cannot test insert.');
            process.exit(1);
        }
        const opId = op.rows[0].id;
        console.log(`Found Operator: ${op.rows[0].username} (ID: ${opId})`);

        // 3. Try Insert
        console.log('Attempting to insert test post...');
        const res = await db.query(
            'INSERT INTO posts (operator_id, image_url, content) VALUES ($1, $2, $3) RETURNING *',
            [opId, 'https://via.placeholder.com/150', 'Debug Test Post']
        );
        console.log('Insert Success! New Post ID:', res.rows[0].id);

        // 4. Verify insertion
        const verify = await db.query('SELECT * FROM posts WHERE id = $1', [res.rows[0].id]);
        console.log('Verification found:', verify.rows.length, 'row(s)');

        process.exit(0);
    } catch (err) {
        console.error('INSERT FAILED:', err.message);
        console.error('Code:', err.code);
        if (err.detail) console.error('Detail:', err.detail);
        process.exit(1);
    }
}

debugRaw();
