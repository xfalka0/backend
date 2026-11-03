const db = require('../db');
async function fixDb() {
  try {
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS city VARCHAR(255),
      ADD COLUMN IF NOT EXISTS age INT,
      ADD COLUMN IF NOT EXISTS relationship VARCHAR(255),
      ADD COLUMN IF NOT EXISTS zodiac VARCHAR(255),
      ADD COLUMN IF NOT EXISTS job VARCHAR(255),
      ADD COLUMN IF NOT EXISTS edu VARCHAR(255),
      ADD COLUMN IF NOT EXISTS boy VARCHAR(255),
      ADD COLUMN IF NOT EXISTS kilo VARCHAR(255),
      ADD COLUMN IF NOT EXISTS interests TEXT,
      ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS gender_change_count INT DEFAULT 0;
    `);
    console.log("Added missing columns to users table");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
fixDb();
