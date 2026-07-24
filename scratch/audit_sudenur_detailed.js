const { Pool } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function auditSudenur() {
  try {
    console.log('=== DETAILED AUDIT FOR SUDENUR (ID: 591) ===\n');

    // 1. User & Operator Account Profile
    const opProfile = await pool.query(`
      SELECT u.id, u.username, u.display_name, u.gender, u.role,
             o.pending_balance, o.lifetime_earnings, o.commission_rate
      FROM users u
      LEFT JOIN operators o ON u.id::text = o.user_id::text
      WHERE u.id::text = '591'
    `);
    console.log('1. User & Operator Profile:');
    console.log(opProfile.rows[0]);

    // 2. Today's Commission Logs (2026-07-24)
    const todayLogs = await pool.query(`
      SELECT id, chat_id, amount, type, created_at
      FROM commission_logs
      WHERE operator_id::text = '591' AND DATE(created_at) = CURRENT_DATE
      ORDER BY created_at ASC
    `);
    console.log('\n2. Today Commission Logs (Count:', todayLogs.rows.length, '):');
    console.log(todayLogs.rows);

    // Sum of today's logs
    const todaySum = await pool.query(`
      SELECT SUM(amount) as today_total, COUNT(*) as today_count
      FROM commission_logs
      WHERE operator_id::text = '591' AND DATE(created_at) = CURRENT_DATE
    `);
    console.log('\n2b. Today Total Earned from Logs:', todaySum.rows[0]);

    // 3. Today's Operator Stats record
    const todayStats = await pool.query(`
      SELECT * FROM operator_stats
      WHERE operator_id::text = '591' AND date = CURRENT_DATE
    `);
    console.log('\n3. Today operator_stats record:');
    console.log(todayStats.rows[0]);

    // 4. All-time total commission logs sum for 591
    const totalLogsSum = await pool.query(`
      SELECT SUM(amount) as total_earned, COUNT(*) as log_count
      FROM commission_logs
      WHERE operator_id::text = '591'
    `);
    console.log('\n4. All-time Total Commission Logs Sum:');
    console.log(totalLogsSum.rows[0]);

    // 5. Total messages sent by 591 today
    const todayMsgSent = await pool.query(`
      SELECT COUNT(*) as msg_count
      FROM messages
      WHERE sender_id::text = '591' AND DATE(created_at) = CURRENT_DATE
    `);
    console.log('\n5. Total Messages Sent by 591 Today:');
    console.log(todayMsgSent.rows[0]);

  } catch (err) {
    console.error('Audit Error:', err);
  } finally {
    await pool.end();
  }
}

auditSudenur();
