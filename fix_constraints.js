const db = require('./db');
async function fix() {
    try {
        await db.query('ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_user_id_fkey, ADD CONSTRAINT chats_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
        await db.query('ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_operator_id_fkey, ADD CONSTRAINT chats_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE CASCADE');
        await db.query('ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey, ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE');
        await db.query('ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey, ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
        
        // Also fix operator_stats if it exists
        try {
            await db.query('ALTER TABLE operator_stats DROP CONSTRAINT IF EXISTS operator_stats_operator_id_fkey, ADD CONSTRAINT operator_stats_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE CASCADE');
        } catch (e) {
            console.log('No operator_stats table or constraint issue');
        }

        try {
            await db.query('ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_operator_id_fkey, ADD CONSTRAINT payouts_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE CASCADE');
        } catch (e) {
            console.log('No payouts table or constraint issue');
        }
        
        console.log('Successfully updated constraints!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
fix();
