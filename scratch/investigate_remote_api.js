const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'falka_super_secret_2024_key_change_me';
const BASE_URL = 'https://backend-kj17.onrender.com/api';

// Create a token for an "Erkek" user (let's say user id 1)
const maleToken = jwt.sign({ id: 1, role: 'user', gender: 'erkek' }, JWT_SECRET, { expiresIn: '1h' });

async function fetchTab(tab, page) {
    try {
        const res = await axios.get(`${BASE_URL}/discovery?tab=${encodeURIComponent(tab)}&page=${page}&limit=10`, {
            headers: { Authorization: `Bearer ${maleToken}` }
        });
        
        const data = res.data.data || res.data;
        const results = data.map(op => ({
            sekme: tab,
            sayfa: page,
            id: op.id,
            ad: op.name,
            gender: op.gender,
            bayi_mi: op.gender === 'coin_bayisi' || op.role === 'coin_bayisi',
            HATALI_MI: (op.gender !== 'kadin' && op.gender !== 'kadın' && op.gender !== 'female' && op.gender !== 'coin_bayisi')
        }));
        return results;
    } catch (e) {
        console.error(`Error fetching tab ${tab} page ${page}:`, e.message);
        return [];
    }
}

async function run() {
    console.log("=== 2) Gerçek API Çağrıları (Erkek hesabı simülasyonu ile) ===");
    const tabs = ['Önerilen', 'Çevrimiçi', 'Yeni', 'Popüler'];
    let allResults = [];
    
    for (const tab of tabs) {
        const page1 = await fetchTab(tab, 1);
        const page2 = await fetchTab(tab, 2);
        allResults = allResults.concat(page1, page2);
    }
    
    console.table(allResults);
    
    const hataliKayitlar = allResults.filter(r => r.HATALI_MI);
    if (hataliKayitlar.length > 0) {
        console.log("⚠️ DİKKAT: Aşağıdaki kayıtlar KADIN veya BAYİ değil ama listeye sızmış!");
        console.table(hataliKayitlar);
    } else {
        console.log("✅ Tüm sayfalarda gelen bütün profiller KADIN veya BAYİ. Karşı cinse ait kimse yok.");
    }
}

run();
