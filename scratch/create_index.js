const db = require('../db');

async function create() {
    try {
        await db.query("CREATE UNIQUE INDEX uq_refund_call_id ON commission_logs (call_id) WHERE type = 'refund'");
        console.log('Successfully created unique index uq_refund_call_id');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

create();
