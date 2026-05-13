const db = require('../db');

async function migrate() {
    try {
        console.log('--- MIGRATION: REFERRAL SYSTEM ---');
        
        // 1. Add referred_by to users
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id) ON DELETE SET NULL');
        console.log('[OK] Added referred_by column to users table');

        // 2. Add referral_code to users (This is the code the user shares)
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE');
        console.log('[OK] Added referral_code column to users table');

        // 3. Generate initial codes for staff/admin users who don't have one
        const staff = await db.query("SELECT id, username FROM users WHERE role IN ('staff', 'admin', 'super_admin', 'operator')");
        for (const user of staff.rows) {
            const code = user.username.toUpperCase().substring(0, 8) + Math.floor(100 + Math.random() * 900);
            await db.query("UPDATE users SET referral_code = $1 WHERE id = $2 AND referral_code IS NULL", [code, user.id]);
        }
        console.log('[OK] Generated initial codes for existing staff');

        console.log('--- MIGRATION COMPLETE ---');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
