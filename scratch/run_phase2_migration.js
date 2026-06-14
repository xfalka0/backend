const db = require('../db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('[Migration] Reading phase2_rooms.sql...');
        const sql = fs.readFileSync(path.join(__dirname, '../db/phase2_rooms.sql'), 'utf8');
        
        console.log('[Migration] Executing SQL script...');
        await db.query(sql);
        
        console.log('[Migration] Phase 2 schema migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('[Migration] Failed to run migration:', err.message);
        process.exit(1);
    }
}

runMigration();
