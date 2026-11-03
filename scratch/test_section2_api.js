const jwt = require('../node_modules/jsonwebtoken');
const SECRET = 'falka_super_secret_2024_key_change_me';
const BASE_URL = 'https://backend-kj17.onrender.com/api';

const maleToken = jwt.sign({ id: 674, role: 'user', gender: 'erkek' }, SECRET);
const femaleToken = jwt.sign({ id: 677, role: 'user', gender: 'kadin' }, SECRET);
const notSetToken = jwt.sign({ id: 720, role: 'user', gender: 'not_set' }, SECRET);
const digerToken = jwt.sign({ id: 67, role: 'user', gender: 'diger' }, SECRET);

const tabs = ['Önerilen', 'Çevrimiçi', 'Yeni', 'Popüler'];

async function fetchDiscovery(token, tab, page = 1, extra = '') {
    const url = `${BASE_URL}/discovery?tab=${encodeURIComponent(tab)}&page=${page}&limit=10${extra}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    return { status: res.status, data };
}

async function run() {
    console.log('=== TEST 2.1: ERKEK HESAP (ID: 674) DISCOVERY ===');
    const maleResults = {};
    for (const tab of tabs) {
        maleResults[tab] = [];
        for (let page = 1; page <= 3; page++) {
            const { status, data } = await fetchDiscovery(maleToken, tab, page);
            if (!Array.isArray(data)) {
                console.log(`[Male] [${tab}] Page ${page} failed:`, status, data);
                continue;
            }
            const genderCounts = {};
            const items = [];
            data.forEach(item => {
                genderCounts[item.gender] = (genderCounts[item.gender] || 0) + 1;
                items.push({ id: item.id, name: item.name, gender: item.gender, is_online: item.is_online, vip_level: item.vip_level });
            });
            maleResults[tab].push({ page, count: data.length, genderCounts, items });
            console.log(`[Male] [${tab}] Page ${page}: ${data.length} items. Genders:`, JSON.stringify(genderCounts));
        }
    }

    console.log('\n=== TEST 2.2: KADIN HESAP (ID: 677) DISCOVERY ===');
    const femaleResults = {};
    for (const tab of tabs) {
        femaleResults[tab] = [];
        for (let page = 1; page <= 3; page++) {
            const { status, data } = await fetchDiscovery(femaleToken, tab, page);
            if (!Array.isArray(data)) {
                console.log(`[Female] [${tab}] Page ${page} failed:`, status, data);
                continue;
            }
            const genderCounts = {};
            const items = [];
            data.forEach(item => {
                genderCounts[item.gender] = (genderCounts[item.gender] || 0) + 1;
                items.push({ id: item.id, name: item.name, gender: item.gender, is_online: item.is_online, vip_level: item.vip_level });
            });
            femaleResults[tab].push({ page, count: data.length, genderCounts, items });
            console.log(`[Female] [${tab}] Page ${page}: ${data.length} items. Genders:`, JSON.stringify(genderCounts));
        }
    }

    console.log('\n=== TEST 2.3: NOT_SET & DIGER CINSIYETLI HESAPLAR ===');
    const notSetRes = await fetchDiscovery(notSetToken, 'Önerilen', 1);
    const notSetCounts = {};
    (notSetRes.data || []).forEach(i => notSetCounts[i.gender] = (notSetCounts[i.gender] || 0) + 1);
    console.log('[not_set (ID: 720)] Status:', notSetRes.status, 'Items:', notSetRes.data?.length, 'Genders:', JSON.stringify(notSetCounts));

    const digerRes = await fetchDiscovery(digerToken, 'Önerilen', 1);
    const digerCounts = {};
    (digerRes.data || []).forEach(i => digerCounts[i.gender] = (digerCounts[i.gender] || 0) + 1);
    console.log('[diger (ID: 67)] Status:', digerRes.status, 'Items:', digerRes.data?.length, 'Genders:', JSON.stringify(digerCounts));

    console.log('\n=== TEST 2.6: ÇEVRİMİÇİ SEKMEDE ÇEVRİMDIŞI PROFİL KONTROLÜ ===');
    const onlineCheck = await fetchDiscovery(maleToken, 'Çevrimiçi', 1, '&limit=50');
    const offlineItems = (onlineCheck.data || []).filter(i => !i.is_online);
    console.log(`[Çevrimiçi Tab] Total returned: ${onlineCheck.data?.length}, Offline items count: ${offlineItems.length}`);
    if (offlineItems.length > 0) {
        console.log('Sample offline item:', offlineItems[0]);
    }

    console.log('\n=== TEST 2.8: CINSIYET KURALI DELME (ERKEK HESAP ?gender=erkek) ===');
    const bypassRes = await fetchDiscovery(maleToken, 'Önerilen', 1, '&gender=erkek');
    const bypassCounts = {};
    (bypassRes.data || []).forEach(i => bypassCounts[i.gender] = (bypassCounts[i.gender] || 0) + 1);
    console.log('Male user querying ?gender=erkek -> Status:', bypassRes.status, 'Items:', bypassRes.data?.length, 'Genders:', JSON.stringify(bypassCounts));
    if (bypassRes.data?.length > 0) {
        console.log('Sample item returned:', { id: bypassRes.data[0].id, name: bypassRes.data[0].name, gender: bypassRes.data[0].gender });
    }

    const fs = require('fs');
    fs.writeFileSync('backend/scratch/section2_results.json', JSON.stringify({
        maleResults,
        femaleResults,
        notSetCounts,
        digerCounts,
        offlineCountInOnlineTab: offlineItems.length,
        bypassCounts
    }, null, 2));
}

run().catch(console.error);

