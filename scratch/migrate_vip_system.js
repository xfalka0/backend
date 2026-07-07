const db = require('../db');

async function migrate() {
    try {
        console.log('[MIGRATION] Starting VIP System migration...');
        
        // 1. Create daily_vip_boost_claims table
        await db.query(`
            CREATE TABLE IF NOT EXISTS daily_vip_boost_claims (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created daily_vip_boost_claims table.');

        // 2. Add min_vip_level column to store_items
        await db.query(`
            ALTER TABLE store_items 
            ADD COLUMN IF NOT EXISTS min_vip_level INT DEFAULT 0
        `);
        console.log('✅ Added min_vip_level column to store_items.');

        // 2b. Add vip_xp and vip_level to users table
        await db.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS vip_xp INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS vip_level INT DEFAULT 0
        `);
        console.log('✅ Ensured vip_xp and vip_level columns exist in users table.');

        // 3. Sync existing users' vip_level based on their vip_xp
        // VIP XP thresholds: VIP 1 (100), VIP 2 (1500), VIP 3 (10000), VIP 4 (20000), VIP 5 (40000), VIP 6 (100000)
        await db.query(`
            UPDATE users 
            SET vip_level = CASE 
                WHEN COALESCE(vip_xp, 0) >= 100000 THEN 6
                WHEN COALESCE(vip_xp, 0) >= 40000 THEN 5
                WHEN COALESCE(vip_xp, 0) >= 20000 THEN 4
                WHEN COALESCE(vip_xp, 0) >= 10000 THEN 3
                WHEN COALESCE(vip_xp, 0) >= 1500 THEN 2
                WHEN COALESCE(vip_xp, 0) >= 100 THEN 1
                ELSE 0
            END
        `);
        console.log('✅ Synchronized existing users\' vip_level based on vip_xp.');
        
        console.log('🎉 VIP System migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        process.exit(0);
    }
}

migrate();
