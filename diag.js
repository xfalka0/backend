const db = require('./db');

async function test() {
    try {
        console.log("Checking schema...");
        const usersTable = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
        const userCols = usersTable.rows.map(r => r.column_name);
        console.log("Users columns:", userCols.join(', '));
        
        const chatsTable = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'chats'");
        const chatCols = chatsTable.rows.map(r => r.column_name);
        console.log("Chats columns:", chatCols.join(', '));

        const operatorsTable = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'operators'");
        if (operatorsTable.rows.length > 0) {
            const opCols = operatorsTable.rows.map(r => r.column_name);
            console.log("Operators columns:", opCols.join(', '));
        } else {
            console.log("Operators table MISSING or EMPTY!");
        }

        console.log("\nRunning admin chats query...");
        const query = `
            SELECT 
                c.*, 
                u.username as user_name,
                u.avatar_url as user_avatar,
                op.username as operator_name,
                op.avatar_url as operator_avatar,
                op.managed_by as managed_by_id,
                (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT COUNT(*)::int FROM messages WHERE chat_id = c.id AND sender_id = c.user_id AND is_read = false) as unread_count
            FROM chats c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN users op ON c.operator_id = op.id
            WHERE EXISTS (SELECT 1 FROM messages m WHERE m.chat_id = c.id)
            ORDER BY c.last_message_at DESC
        `;
        const result = await db.query(query);
        console.log("SUCCESS! Found", result.rows.length, "chats.");
    } catch (err) {
        console.error("DIAGNOSTIC ERROR:", err.message);
        console.error(err.stack);
    } finally {
        process.exit();
    }
}

test();
