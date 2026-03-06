const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Configuration
const DB_NAME = process.env.DB_NAME || 'dating_db';
const DB_USER = process.env.DB_USER || 'postgres';
const BACKUP_DIR = path.join(__dirname, '../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(BACKUP_DIR, `${DB_NAME}_backup_${timestamp}.sql`);

// DATABASE_URL format checking for Render
const dbUrl = process.env.DATABASE_URL;

const performBackup = () => {
    console.log(`[BACKUP] Starting backup for ${DB_NAME}...`);

    let command;
    if (dbUrl) {
        // Use pg_dump with full URL (common for Render/Managed DBs)
        command = `pg_dump "${dbUrl}" > "${backupFile}"`;
    } else {
        // Fallback to local postgres
        command = `pg_dump -U ${DB_USER} ${DB_NAME} > "${backupFile}"`;
    }

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`[BACKUP ERROR] ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`[BACKUP INFO] ${stderr}`);
        }
        console.log(`[BACKUP SUCCESS] Saved to ${backupFile}`);

        // Optional: Keep only last 7 days of backups
        cleanOldBackups();
    });
};

const cleanOldBackups = () => {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    files.forEach(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > SEVEN_DAYS) {
            fs.unlinkSync(filePath);
            console.log(`[BACKUP CLEANUP] Deleted old backup: ${file}`);
        }
    });
};

performBackup();
