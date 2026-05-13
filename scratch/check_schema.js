const db = require('../db');

async function checkSchema() {
    try {
        const res = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'photos'");
        console.log('Users photos column:', res.rows[0]);

        const resOp = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'operators' AND column_name = 'photos'");
        console.log('Operators photos column:', resOp.rows[0]);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
