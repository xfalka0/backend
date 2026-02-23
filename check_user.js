const db = require('./db');

async function checkUser() {
    try {
        const username = 'mustafa%';
        console.log(`Checking users starting with: ${username}`);

        const userRes = await db.query('SELECT * FROM users WHERE username ILIKE $1 OR email ILIKE $1', [username]);
        if (userRes.rows.length === 0) {
            console.log('User not found in users table.');
            return;
        }

        const user = userRes.rows[0];
        console.log('User found:', {
            id: user.id,
            username: user.username,
            role: user.role,
            account_status: user.account_status,
            gender: user.gender
        });

        const opRes = await db.query('SELECT * FROM operators WHERE user_id = $1', [user.id]);
        if (opRes.rows.length === 0) {
            console.log('User is NOT in operators table. (They won\'t show up in discovery)');
        } else {
            console.log('Operator entry found:', opRes.rows[0]);
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkUser();
