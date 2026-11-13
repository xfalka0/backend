const db = require('../db');

async function check() {
  const colRes = await db.query("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'balance'");
  console.log('Balance Column:', colRes.rows);

  const conRes = await db.query("SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'users'::regclass");
  const balCons = conRes.rows.filter(c => c.def.toLowerCase().includes('balance'));
  console.log('Balance Constraints:', balCons);

  process.exit(0);
}

check().catch(console.error);

