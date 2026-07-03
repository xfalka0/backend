const db = require('../db');
const { getExplore } = require('../controllers/socialController');

async function main() {
    try {
        // Let's mock a user. Let's find an active user ID first.
        const userRes = await db.query("SELECT id, display_name, gender, role FROM users WHERE role = 'user' LIMIT 1");
        const testUser = userRes.rows[0];
        console.log('Testing getExplore with user:', testUser);

        const req = {
            query: { user_id: testUser.id },
            app: {
                get: (key) => {
                    return null;
                }
            }
        };

        const res = {
            json: (data) => {
                console.log('--- EXPLORE RESPONSE ---');
                console.log('Stories count:', data.stories.length);
                console.log('Posts count:', data.posts.length);
                if (data.posts.length > 0) {
                    console.log('First post details:', JSON.stringify(data.posts[0], null, 2));
                }
            },
            status: (code) => {
                console.log('Status code:', code);
                return res;
            }
        };

        await getExplore(req, res);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
