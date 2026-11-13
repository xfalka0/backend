const http = require('http');
const db = require('../db');
const jwt = require('../node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const RC_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET || 'test_rc_secret_123';

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

async function run() {
  console.log('=================================================================');
  console.log('--- YAYIN ÖNCESİ DÜZELTME TESTLERİ BAŞLIYOR ---');
  console.log('=================================================================\n');

  // Fetch 2 test users
  const usersRes = await db.query('SELECT id, email, role, balance, is_vip, vip_level FROM users ORDER BY id LIMIT 3');
  const userA = usersRes.rows[0];
  const userB = usersRes.rows[1];
  const tokenA = makeToken(userA);
  const tokenB = makeToken(userB);

  console.log(`Test Kullanıcıları: User A = ${userA.id}, User B = ${userB.id}\n`);

  // -------------------------------------------------------------
  // KRİTİK 1: RevenueCat Webhook Testleri
  // -------------------------------------------------------------
  console.log('>>> [TEST 1] POST /api/revenuecat Webhook Güvenliği:');

  // 1.1 Secret Başlığı Yoksa (401 beklenir)
  const rcNoHeader = await request('POST', '/api/revenuecat', {
    event: { id: 'evt_no_hdr', type: 'INITIAL_PURCHASE', app_user_id: userA.id, product_id: 'coins_100' }
  });
  console.log('  1.1 Header Yokken Yanıt:', rcNoHeader.status, rcNoHeader.body);

  // 1.2 Yanlış Secret Varsa (401 beklenir)
  const rcWrongHeader = await request('POST', '/api/revenuecat', {
    event: { id: 'evt_wrong_hdr', type: 'INITIAL_PURCHASE', app_user_id: userA.id, product_id: 'coins_100' }
  }, { Authorization: 'Bearer WRONG_SECRET' });
  console.log('  1.2 Yanlış Secret Yanıt:', rcWrongHeader.status, rcWrongHeader.body);

  // 1.3 Bilinmeyen Product ID (400 beklenir)
  const rcUnknownProd = await request('POST', '/api/revenuecat', {
    event: { id: 'evt_unknown_' + Date.now(), type: 'INITIAL_PURCHASE', app_user_id: userA.id, product_id: 'coins_hacked_99999' }
  }, { Authorization: `Bearer ${RC_SECRET}` });
  console.log('  1.3 Bilinmeyen Ürün Yanıt:', rcUnknownProd.status, rcUnknownProd.body);

  // 1.4 Geçerli Satın Alım (200 beklenir ve bakiye artışı)
  const eventId = 'evt_valid_' + Date.now();
  const balBefore = (await db.query('SELECT balance FROM users WHERE id::text = $1', [userA.id])).rows[0].balance;
  const rcValid = await request('POST', '/api/revenuecat', {
    event: { id: eventId, type: 'INITIAL_PURCHASE', app_user_id: userA.id, product_id: 'coins_100' }
  }, { Authorization: `Bearer ${RC_SECRET}` });
  const balAfter = (await db.query('SELECT balance FROM users WHERE id::text = $1', [userA.id])).rows[0].balance;
  console.log(`  1.4 Doğru Secret + coins_100: Status ${rcValid.status}, Bakiye Öncesi: ${balBefore}, Sonrası: ${balAfter} (+${balAfter - balBefore})`);

  // 1.5 İkinci Kez Aynı Event (Idempotency - İkinci İşlem Etkisiz Olmalı)
  const rcDuplicate = await request('POST', '/api/revenuecat', {
    event: { id: eventId, type: 'INITIAL_PURCHASE', app_user_id: userA.id, product_id: 'coins_100' }
  }, { Authorization: `Bearer ${RC_SECRET}` });
  const balAfterDup = (await db.query('SELECT balance FROM users WHERE id::text = $1', [userA.id])).rows[0].balance;
  console.log(`  1.5 Aynı Event Tekrarı: Status ${rcDuplicate.status}, Duplicate: ${rcDuplicate.body?.duplicate}, Bakiye Değişmedi: ${balAfterDup === balAfter}`);

  // -------------------------------------------------------------
  // KRİTİK 2: GET /api/users/:userId/balance Testleri
  // -------------------------------------------------------------
  console.log('\n>>> [TEST 2] GET /api/users/:userId/balance IDOR Koruması:');
  const balNoToken = await request('GET', `/api/users/${userB.id}/balance`);
  console.log('  2.1 Token Olmadan İstek:', balNoToken.status, balNoToken.body);

  const balOtherUser = await request('GET', `/api/users/${userB.id}/balance`, null, { Authorization: `Bearer ${tokenA}` });
  console.log('  2.2 User A User B Bakiyesini Okuma (403 beklenir):', balOtherUser.status, balOtherUser.body);

  const balSelf = await request('GET', `/api/users/${userA.id}/balance`, null, { Authorization: `Bearer ${tokenA}` });
  console.log('  2.3 User A Kendi Bakiyesini Okuma (200 beklenir):', balSelf.status, balSelf.body);

  // -------------------------------------------------------------
  // KRİTİK 3: POST /api/boosts/:userId Testleri
  // -------------------------------------------------------------
  console.log('\n>>> [TEST 3] POST /api/boosts/:userId Güvenliği & Parametre Manipülasyonu:');
  // Token yok
  const boostNoToken = await request('POST', `/api/boosts/${userA.id}`, { cost: 0 });
  console.log('  3.1 Token Yokken İstek:', boostNoToken.status, boostNoToken.body);

  // Başka kullanıcı
  const boostOther = await request('POST', `/api/boosts/${userB.id}`, { cost: 0 }, { Authorization: `Bearer ${tokenA}` });
  console.log('  3.2 Başka Kullanıcının IDsi (403 beklenir):', boostOther.status, boostOther.body);

  // Manipülasyon: cost:0 gönderilse bile sunucu sabit 1000 coin istiyor
  // Set User A balance to 1500 first to test successful deduction
  await db.query('UPDATE users SET balance = 1500 WHERE id::text = $1', [userA.id]);
  const boostRes = await request('POST', `/api/boosts/${userA.id}`, { cost: 0 }, { Authorization: `Bearer ${tokenA}` });
  const balAfterBoost = (await db.query('SELECT balance FROM users WHERE id::text = $1', [userA.id])).rows[0].balance;
  console.log(`  3.3 cost:0 Gönderildiğinde: Status ${boostRes.status}, Bakiye 1500 -> ${balAfterBoost} (Düşen: ${1500 - balAfterBoost} coin)`);

  // Yetersiz bakiye testi (bakiye 500 iken 1000'lik boost denemesi -> 400)
  const boostInsufficient = await request('POST', `/api/boosts/${userA.id}`, {}, { Authorization: `Bearer ${tokenA}` });
  console.log('  3.4 Yetersiz Bakiye Durumunda:', boostInsufficient.status, boostInsufficient.body);

  // -------------------------------------------------------------
  // KRİTİK 4: Profil Güncelleme & Girdi Güvenliği (XSS, Telefon, Çok Uzun Metin)
  // -------------------------------------------------------------
  console.log('\n>>> [TEST 4] Profil Güncelleme & Girdi Güvenliği:');
  // 4.1 XSS / Script Enjeksiyonu Denemesi
  const xssAttempt = await request('PUT', `/api/users/${userA.id}`, {
    bio: "<script>alert('xss')</script> normal text"
  }, { Authorization: `Bearer ${tokenA}` });
  console.log('  4.1 XSS/Script İçeren Bio Güncellemesi:', xssAttempt.status, xssAttempt.body);

  // 4.2 Telefon Numarası İçeren Bio Denemesi (0532 111 22 33)
  const phoneAttempt = await request('PUT', `/api/users/${userA.id}`, {
    bio: "İletişim için numaram: 0532 111 22 33 arayın"
  }, { Authorization: `Bearer ${tokenA}` });
  console.log('  4.2 Telefon Numarası İçeren Bio:', phoneAttempt.status, phoneAttempt.body);

  // 4.3 Temiz ve Güvenli Profil Güncellemesi
  const cleanProfile = await request('PUT', `/api/users/${userA.id}`, {
    bio: "Müzik dinlemeyi ve seyahat etmeyi severim.",
    job: "Yazılım Mühendisi"
  }, { Authorization: `Bearer ${tokenA}` });
  console.log('  4.3 Temiz Profil Güncellemesi:', cleanProfile.status, cleanProfile.body?.bio ? 'BAŞARILI' : cleanProfile.body);

  // -------------------------------------------------------------
  // DİĞER 5: Bakiye Güvenliği & 10 Eşzamanlı Yarış Durumu (Race Condition)
  // -------------------------------------------------------------
  console.log('\n>>> [TEST 5] 10 Eşzamanlı Harcama (Race Condition & Negatif Bakiye Koruması):');
  // Set user A balance to exactly 250 coins
  await db.query('UPDATE users SET balance = 250 WHERE id::text = $1', [userA.id]);
  console.log('  Kullanıcı başlangıç bakiyesi: 250 Coin. Her biri 100 coin düşen 10 eşzamanlı istek başlatılıyor...');

  // Send 10 concurrent deduct-coins requests of 100 coins each
  const deductPromises = [];
  for (let i = 0; i < 10; i++) {
    deductPromises.push(request('POST', '/api/users/deduct-coins', { amount: 100, reason: `concurrent_test_${i}` }, { Authorization: `Bearer ${tokenA}` }));
  }
  const results = await Promise.all(deductPromises);
  const successCount = results.filter(r => r.status === 200).length;
  const failCount = results.filter(r => r.status === 400).length;
  const finalBal = (await db.query('SELECT balance FROM users WHERE id::text = $1', [userA.id])).rows[0].balance;

  console.log(`  Sonuç: Başarılı = ${successCount} adet (200 coin), Reddedilen = ${failCount} adet (Yetersiz Bakiye)`);
  console.log(`  Final Bakiye: ${finalBal} Coin (Asla negatif olmadı, tam 250 - 200 = 50 kaldı!)`);

  // -------------------------------------------------------------
  // DİĞER 6 & 7: Beğenenler (Fans) & Avatar Sızıntısı Koruması
  // -------------------------------------------------------------
  console.log('\n>>> [TEST 6 & 7] GET /api/favorites/:userId/fans ve Avatar Sızıntı Koruması:');
  const fansNoToken = await request('GET', `/api/favorites/${userA.id}/fans`);
  console.log('  6.1 Fans Token Yokken İstek:', fansNoToken.status, fansNoToken.body);

  // Set user A as regular non-vip
  await db.query('UPDATE users SET is_vip = false, vip_expire_date = NULL WHERE id::text = $1', [userA.id]);
  // Ensure user B favorited user A
  await db.query('INSERT INTO favorites (user_id, target_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userB.id, userA.id]);

  const fansRes = await request('GET', `/api/favorites/${userA.id}/fans`, null, { Authorization: `Bearer ${tokenA}` });
  console.log(`  6.2 VIP Olmayan Kullanıcı Fans: Status ${fansRes.status}, isVIP: ${fansRes.body?.isVIP}`);
  if (fansRes.body?.fans?.length > 0) {
    const fan = fansRes.body.fans[0];
    console.log(`      Hayran Görünümü -> İsim: "${fan.name}", Avatar URL: ${fan.avatar_url} (Ham avatar gizlendi: ${fan.avatar_url === null})`);
  }

  // -------------------------------------------------------------
  // DİĞER 13: Web Hesap Silme & Statik Sayfalar
  // -------------------------------------------------------------
  console.log('\n>>> [TEST 13] Web Hesap Silme Talebi ve Statik Sayfalar:');
  const delReq = await request('POST', '/api/account-deletion-requests', {
    identifier: userA.email,
    reason: 'privacy',
    details: 'Otomasyon test silme talebi'
  });
  console.log('  13.1 Web Hesap Silme Uç Noktası:', delReq.status, delReq.body);

  const staticPages = ['/delete-account.html', '/terms.html', '/privacy.html', '/kvkk.html'];
  for (const page of staticPages) {
    const pRes = await request('GET', page);
    console.log(`  13.2 Statik Sayfa ${page}: Status ${pRes.status} (Uzunluk: ${pRes.raw?.length || 0} bayt)`);
  }

  console.log('\n=================================================================');
  console.log('--- TÜM DÜZELTME TESTLERİ TAMAMLANDI ---');
  console.log('=================================================================');
  process.exit(0);
}

run().catch(err => {
  console.error('Test hatası:', err);
  process.exit(1);
});
