const db = require('./db');

async function migrate() {
    try {
        console.log("Starting migration...");

        // 1. Add age column to users
        await db.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS age INTEGER DEFAULT 18
        `);
        console.log("Added 'age' column to users.");

        // 2. Add vip_level column to users
        await db.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS vip_level INTEGER DEFAULT 0
        `);
        console.log("Added 'vip_level' column to users.");

        // 3. Update existing is_vip to vip_level 1 if true
        await db.query(`
            UPDATE users SET vip_level = 1 WHERE is_vip = true AND vip_level = 0
        `);
        console.log("Updated existing VIP status to level 1.");

        console.log("Migration completed successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
