const db = require('../db');

async function main() {
    const callerId = 65; // fgd
    const receiverId = 170; // Su

    let chatRes = await db.query(
        'SELECT id FROM chats WHERE (user_id = $1 AND operator_id = $2) OR (user_id = $2 AND operator_id = $1)',
        [callerId, receiverId]
    );

    console.log('Chat between 65 and 170:', chatRes.rows[0]);
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
