const path = require('path');
require('../node_modules/dotenv').config({ path: path.join(__dirname, '../.env') });

const request = require('../node_modules/supertest');
const jwt = require('../node_modules/jsonwebtoken');
const { app } = require('../server');
const db = require('../db');

const SECRET = process.env.JWT_SECRET || 'falka_super_secret_2024_key_change_me';

async function runTests() {
    console.log('====================================================');
    console.log('🚀 FİVA DATING APP - DÜZELTME DOĞRULAMA TESTLERİ');
    console.log('====================================================\n');

    // Fetch dynamic male and female user from DB
    const maleRes = await db.query("SELECT id, username, gender FROM users WHERE gender = 'erkek' LIMIT 1");
    const femaleRes = await db.query("SELECT id, username, gender FROM users WHERE gender = 'kadin' LIMIT 1");

    const maleUser = maleRes.rows[0];
    const femaleUser = femaleRes.rows[0];

    console.log(`Test Male User: ${maleUser.username} (${maleUser.id})`);
    console.log(`Test Female User: ${femaleUser.username} (${femaleUser.id})\n`);

    const maleToken = jwt.sign({ id: maleUser.id, role: 'user', gender: 'erkek' }, SECRET);
    const femaleToken = jwt.sign({ id: femaleUser.id, role: 'user', gender: 'kadin' }, SECRET);

    // TEST 1: CİNSİYET KURALI DELİNMESİ
    console.log('--- TEST 1: CİNSİYET KURALI DOĞRULAMASI (Erkek Token) ---');
    const genderQueries = ['gender=erkek', 'gender=kadin', 'gender=herkes', 'gender='];
    const genderResults = [];

    for (const q of genderQueries) {
        const res = await request(app)
            .get(`/api/discovery?${q}`)
            .set('Authorization', `Bearer ${maleToken}`);

        const list = res.body?.data || (Array.isArray(res.body) ? res.body : []);
        const maleCount = list.filter(u => u.gender === 'erkek').length;
        const femaleCount = list.filter(u => u.gender === 'kadin' || u.gender === 'kadın' || u.gender === 'female').length;
        const resellerCount = list.filter(u => u.gender === 'coin_bayisi').length;

        genderResults.push({
            Query: q,
            Status: res.status,
            Total: list.length,
            Kadin: femaleCount,
            Bayi: resellerCount,
            Erkek: maleCount,
            Pass: (res.status === 200 && maleCount === 0) ? 'GEÇTİ (Erkek = 0)' : 'KALDI'
        });
    }
    console.table(genderResults);

    // TEST 2: SEKME PARAMETRELERİ (İngilizce, Türkçe, ASCII, Hatalı)
    console.log('\n--- TEST 2: SEKME PARAMETRELERİ DOĞRULAMASI ---');
    const tabs = [
        // English
        'recommended', 'online', 'new', 'popular',
        // Turkish
        'önerilen', 'çevrimiçi', 'yeni', 'popüler',
        // ASCII
        'onerilen', 'cevrimici', 'populer',
        // Invalid
        'rastgele_sekme', 'admin_sekmesi', 'xyz'
    ];

    const tabResults = [];
    for (const t of tabs) {
        const res = await request(app)
            .get(`/api/discovery?tab=${encodeURIComponent(t)}`)
            .set('Authorization', `Bearer ${maleToken}`);

        const isInvalid = ['rastgele_sekme', 'admin_sekmesi', 'xyz'].includes(t);
        tabResults.push({
            Tab: t,
            Status: res.status,
            DataCount: res.body?.data?.length ?? (Array.isArray(res.body) ? res.body.length : 0),
            HasMore: res.body?.hasMore,
            Expected: isInvalid ? '400 (Hata)' : '200 (Başarılı)',
            Pass: (isInvalid ? res.status === 400 : res.status === 200) ? 'GEÇTİ' : 'KALDI'
        });
    }
    console.table(tabResults);

    // TEST 3: SAYFALAMA VE LİMİT ÜST SINIRI (Max 30)
    console.log('\n--- TEST 3: SAYFALAMA VE LİMİT KONTROLÜ ---');
    const resLimit100 = await request(app)
        .get('/api/discovery?limit=100')
        .set('Authorization', `Bearer ${maleToken}`);

    const resLimit20 = await request(app)
        .get('/api/discovery?limit=20')
        .set('Authorization', `Bearer ${maleToken}`);

    console.log('limit=100 İsteği -> Response Limit Değeri:', resLimit100.body?.limit, '(Maks 30 olmalı) ->', resLimit100.body?.limit <= 30 ? 'GEÇTİ' : 'KALDI');
    console.log('limit=20 İsteği -> Dönen Kayıt:', resLimit20.body?.data?.length, '| hasMore:', resLimit20.body?.hasMore);

    // TEST 4: YAŞ SINIRI (18-99) DOĞRUDAN API TESTİ
    console.log(`\n--- TEST 4: YAŞ SINIRI KONTROLÜ (PUT /api/users/${maleUser.id}/profile) ---`);
    const testAges = [
        { age: 15, expected: 400 },
        { age: 17, expected: 400 },
        { age: 100, expected: 400 },
        { age: 'abc', expected: 400 },
        { age: -5, expected: 400 },
        { age: 18, expected: 200 },
        { age: 25, expected: 200 },
        { age: 99, expected: 200 }
    ];

    const ageResults = [];
    for (const item of testAges) {
        const res = await request(app)
            .put(`/api/users/${maleUser.id}/profile`)
            .send({ age: item.age });

        ageResults.push({
            AgeInput: item.age,
            Status: res.status,
            Error: res.body?.error || 'Yok (Başarılı)',
            Pass: res.status === item.expected ? 'GEÇTİ' : 'KALDI'
        });
    }
    console.table(ageResults);

    console.log('\n====================================================');
    console.log('✅ TÜM DOĞRULAMA TESTLERİ TAMAMLANDI.');
    console.log('====================================================');

    await db.pool.end();
}

runTests().catch(err => {
    console.error('Test hatası:', err);
    process.exit(1);
});
