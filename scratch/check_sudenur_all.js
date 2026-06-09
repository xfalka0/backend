const { Pool } = require('pg');

const connectionString = 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true';
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('--- Full Database Audit for operator 591 ---');

    // 1. Check operator_stats
    const statsRes = await pool.query('SELECT * FROM operator_stats WHERE operator_id::text = \'591\'');
    console.log('\n1. operator_stats for 591:');
    console.log(statsRes.rows);

    // 2. Check chats where 591 is the operator
    const chatsRes = await pool.query('SELECT id, user_id, last_message, last_message_at FROM chats WHERE operator_id::text = \'591\'');
    console.log('\n2. Chats for operator 591:');
    console.log(chatsRes.rows);

    // 3. Check messages sent by operator 591
    const msgCountRes = await pool.query('SELECT count(*), max(created_at) FROM messages WHERE sender_id::text = \'591\'');
    console.log('\n3. Messages sent by operator 591:');
    console.log(msgCountRes.rows[0]);

    // 4. Check if there are messages with earned_diamonds for 591
    const diamondsMsgRes = await pool.query('SELECT count(*), sum(earned_diamonds) FROM messages WHERE sender_id::text = \'591\' AND earned_diamonds > 0');
    console.log('\n4. Messages sent by operator 591 with earned_diamonds > 0:');
    console.log(diamondsMsgRes.rows[0]);

    // 5. Check all commission logs in the DB to see if any logs exist at all
    const allLogsRes = await pool.query('SELECT count(*), max(created_at) FROM commission_logs');
    console.log('\n5. Total commission logs in database:');
    console.log(allLogsRes.rows[0]);

    // 6. Check list of recent commission logs in DB (first 5 of any operator)
    const sampleLogs = await pool.query('SELECT id, operator_id, chat_id, amount, agency_id, created_at FROM commission_logs ORDER BY created_at DESC LIMIT 5');
    console.log('\n6. Recent 5 commission logs for any operator:');
    console.log(sampleLogs.rows);

  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    await pool.end();
  }
}

run();
