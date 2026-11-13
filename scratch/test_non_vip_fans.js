const db = require('../db');
const http = require('http');
const jwt = require('../node_modules/jsonwebtoken');

async function testNonVipFan() {
  const normUser = await db.query("SELECT id, email FROM users WHERE role = 'user' LIMIT 1");
  const uid = normUser.rows[0].id;
  await db.query('UPDATE users SET is_vip = false, vip_expire_date = NULL WHERE id = $1', [uid]);
  
  // ensure someone favorited this user
  const otherUser = await db.query("SELECT id FROM users WHERE id != $1 LIMIT 1", [uid]);
  await db.query("INSERT INTO favorites (user_id, target_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [otherUser.rows[0].id, uid]);

  const token = jwt.sign({ id: uid, role: 'user' }, 'your-secret-key');

  const req = http.request({
    hostname: '127.0.0.1', port: 5001, path: '/api/favorites/' + uid + '/fans',
    method: 'GET', headers: { Authorization: 'Bearer ' + token }
  }, (res) => {
    let b = '';
    res.on('data', c => b += c);
    res.on('end', () => {
      const data = JSON.parse(b);
      console.log('Regular user fans result: isVIP =', data.isVIP, 'Fans count =', data.fans?.length);
      if (data.fans?.length > 0) {
        console.log('Sample fan:', { name: data.fans[0].name, avatar: data.fans[0].avatar_url, is_blurred: data.fans[0].is_blurred });
      }
      process.exit(0);
    });
  });
  req.end();
}
testNonVipFan();
