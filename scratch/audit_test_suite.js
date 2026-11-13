const db = require('../db');
const http = require('http');
const jwt = require('../node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function makeToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '1h' });
}

function request(method, path, body, headers = {}) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5001,
      path,
      method,
      headers: {
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers
      }
    }, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, raw: buf }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  const usersRes = await db.query('SELECT id, email, role, balance, vip_level FROM users LIMIT 5');
  const userA = usersRes.rows[0];
  const userB = usersRes.rows[1];
  const tokenA = makeToken(userA);
  const tokenB = makeToken(userB);

  console.log('User A:', userA.id, 'User B:', userB.id);

  console.log('\n--- TEST D.1: IDOR on /api/users/:id ---');
  const getProfileB = await request('GET', '/api/users/' + userB.id, null, { Authorization: 'Bearer ' + tokenA });
  console.log('User A reading User B profile status:', getProfileB.status);
  if (getProfileB.body) {
    console.log('Returned profile keys:', Object.keys(getProfileB.body));
    console.log('Leaked sensitive fields:', {
      phone: getProfileB.body.phone,
      email: getProfileB.body.email,
      password_hash: getProfileB.body.password_hash,
      device_id: getProfileB.body.device_id
    });
  }

  console.log('\n--- TEST D.2: Discovery Leak Check ---');
  const discRes = await request('GET', '/api/discovery', null, { Authorization: 'Bearer ' + tokenA });
  console.log('Discovery status:', discRes.status);
  const sampleCard = discRes.body?.data?.[0] || discRes.body?.profiles?.[0] || discRes.body?.[0];
  if (sampleCard) {
    console.log('Discovery card keys:', Object.keys(sampleCard));
    console.log('Discovery leaks:', {
      phone: sampleCard.phone,
      email: sampleCard.email,
      password_hash: sampleCard.password_hash,
      token: sampleCard.token
    });
  }

  console.log('\n--- TEST D.3: IDOR on /api/users/:id/balance ---');
  const balRes = await request('GET', '/api/users/' + userB.id + '/balance', null, { Authorization: 'Bearer ' + tokenA });
  console.log('User A reading User B balance status:', balRes.status, balRes.body);

  console.log('\n--- TEST B.5.1 / D.4: Fake Purchase with manual_ prefix ---');
  const balBefore = (await db.query('SELECT balance FROM users WHERE id = $1', [userA.id])).rows[0].balance;
  const fakePurchase = await request('POST', '/api/purchase', {
    productId: 1,
    transactionId: 'manual_hack_' + Date.now()
  }, { Authorization: 'Bearer ' + tokenA });
  const balAfter = (await db.query('SELECT balance FROM users WHERE id = $1', [userA.id])).rows[0].balance;
  console.log('Fake manual_ purchase status:', fakePurchase.status, fakePurchase.body);
  console.log('User A balance before:', balBefore, 'after fake purchase:', balAfter);

  console.log('\n--- TEST D.5: VIP Upgrade Direct without receipt ---');
  const vipRes = await request('POST', '/api/vip/upgrade-direct', {
    months: 12
  }, { Authorization: 'Bearer ' + tokenA });
  console.log('Upgrade direct status:', vipRes.status, vipRes.body);

  console.log('\n--- TEST D.6: Tampered Boost (cost: 0) ---');
  const boostRes = await request('POST', '/api/boosts/' + userA.id, {
    cost: 0
  }, { Authorization: 'Bearer ' + tokenA });
  console.log('Boost status:', boostRes.status, boostRes.body);

  console.log('\n--- TEST D.8: Input Injection (<script>, SQL) ---');
  const injRes = await request('PUT', '/api/users/' + userA.id, {
    bio: "<script>alert('xss')</script> ' OR 1=1 --"
  }, { Authorization: 'Bearer ' + tokenA });
  console.log('Input injection status:', injRes.status, injRes.body?.bio ? 'Bio accepted' : injRes.body);

  console.log('\n--- TEST C: Account Deletion Soft/Hard ---');
  // Create a dummy user to test deletion
  const dummyRes = await db.query(
    "INSERT INTO users (email, phone, display_name, password_hash, birth_date, gender, looking_for) VALUES ('delete_test@test.local', '05551112233', 'Delete Test', 'hash', '1995-01-01', 'male', 'female') RETURNING id"
  );
  const dummyId = dummyRes.rows[0].id;
  const dummyToken = makeToken({ id: dummyId, email: 'delete_test@test.local' });
  const delRes = await request('DELETE', '/api/users/' + dummyId, null, { Authorization: 'Bearer ' + dummyToken });
  console.log('Delete account status:', delRes.status, delRes.body);
  const dbDummy = (await db.query('SELECT id, email, phone, display_name, account_status FROM users WHERE id = $1', [dummyId])).rows[0];
  console.log('Dummy user DB state after deletion:', dbDummy);

  process.exit(0);
}

runTests().catch(err => {
  console.error('Audit test failed:', err);
  process.exit(1);
});

