const db = require('../db');

async function cleanupTestPayouts() {
  try {
    const res = await db.query("DELETE FROM payouts WHERE iban LIKE 'TR1234%' OR account_holder = 'Zeliha Demir' OR payment_method = 'IBAN'");
    console.log(`✅ Deleted ${res.rowCount} test payout records from payouts table.`);
  } catch (err) {
    console.error('Error cleaning test payouts:', err.message);
  } finally {
    process.exit();
  }
}

cleanupTestPayouts();
