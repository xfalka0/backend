const db = require('../db');

async function testPayout() {
  try {
    const user = await db.query("SELECT id FROM users WHERE role IN ('operator', 'moderator', 'admin', 'staff') OR (gender = 'kadin') LIMIT 1");
    if (user.rows.length === 0) {
      console.log('No user found');
      return;
    }
    const userId = user.rows[0].id;
    
    const res = await db.query(
      "INSERT INTO payouts (operator_id, amount, status, payment_method, iban, account_holder, cash_amount, exchange_rate) VALUES ($1, 10000, 'pending', 'IBAN', 'TR123456789012345678901234', 'Zeliha Demir', 236.75, 47.35) RETURNING id",
      [userId]
    );
    console.log('✅ Created test pending payout ID:', res.rows[0].id);
  } catch (err) {
    console.error('Error creating payout:', err.message);
  } finally {
    process.exit();
  }
}

testPayout();
