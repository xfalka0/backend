
const { Client } = require('pg');
require('dotenv').config();

async function check() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
    });

    try {
        await client.connect();
        console.log("Connected to DB");

        const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log("Tables:", tables.rows.map(r => r.table_name).join(', '));

        const qrCheck = await client.query("SELECT count(*) FROM quick_replies").catch(e => ({ error: e.message }));
        if (qrCheck.error) {
            console.log("quick_replies table error:", qrCheck.error);
        } else {
            console.log("quick_replies count:", qrCheck.rows[0].count);
        }

    } catch (err) {
        console.error("Diagnostic error:", err);
    } finally {
        await client.end();
    }
}

check();
