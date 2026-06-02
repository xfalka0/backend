const db = require('./db');

async function check() {
  try {
    const tableInfo = await db.query(`
      SELECT table_name, column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name IN ('agencies', 'users', 'agency_invitations')
      ORDER BY table_name, column_name;
    `);
    console.log('Columns:');
    console.log(tableInfo.rows);
    
    // Let's try creating agency_invitations table with verbose error
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS agency_invitations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            agency_id TEXT REFERENCES agencies(id) ON DELETE CASCADE,
            operator_id UUID REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(agency_id, operator_id, status)
        )
      `);
      console.log('agency_invitations created successfully!');
    } catch (e) {
      console.error('Failed to create agency_invitations:', e);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

check();
