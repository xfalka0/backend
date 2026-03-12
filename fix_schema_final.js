
const db = require('./db');

async function fixSchema() {
    try {
        console.log("Creating quick_replies table...");
        await db.query(`
            CREATE TABLE IF NOT EXISTS quick_replies (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log("✅ quick_replies table created/checked.");

        // Add some initial quick replies
        const countRes = await db.query("SELECT count(*) FROM quick_replies");
        if (parseInt(countRes.rows[0].count) === 0) {
            await db.query(`
                INSERT INTO quick_replies (title, content) VALUES 
                ('Hoş Geldin', 'Merhaba! Aramıza hoş geldin. Seninle tanışmak harika.'),
                ('Görüşürüz', 'Şimdilik gitmem gerekiyor, sonra tekrar konuşuruz!'),
                ('Hediye İçin Teşekkürler', 'Hediye için çok teşekkür ederim, beni çok mutlu ettin!')
            `);
            console.log("✅ Initial quick replies added.");
        }

    } catch (err) {
        console.error("❌ Schema fix error:", err);
    } finally {
        process.exit();
    }
}

fixSchema();
