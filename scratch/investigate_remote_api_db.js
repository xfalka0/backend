const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true',
    ssl: { rejectUnauthorized: false }
});

async function fetchTab(tab, pageNum) {
    const limitNum = 10;
    const offset = (pageNum - 1) * limitNum;
    const targetGender = 'kadin'; // For male user
    const userId = -1; // fake

    let whereClause = `WHERE (LOWER(u.gender) = LOWER($1) OR u.gender = 'coin_bayisi' OR (LOWER($1) = 'kadin' AND LOWER(u.gender) IN ('kadin', 'kadın', 'female')) OR (LOWER($1) = 'erkek' AND LOWER(u.gender) IN ('erkek', 'male'))) AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff')`;
    
    let orderByClause = '';
    if (tab === 'Yeni') {
        orderByClause = 'ORDER BY u.created_at DESC, u.id DESC';
    } else if (tab === 'Popüler') {
        orderByClause = 'ORDER BY u.vip_level DESC, COALESCE(o.rating, 0) DESC, u.created_at DESC, u.id DESC';
    } else if (tab === 'Çevrimiçi') {
        whereClause += ' AND o.is_online = TRUE';
        orderByClause = 'ORDER BY o.last_active_at DESC NULLS LAST, u.vip_level DESC, u.created_at DESC, u.id DESC';
    } else {
        orderByClause = 'ORDER BY o.is_online DESC NULLS LAST, (u.created_at >= NOW() - INTERVAL \'3 days\') DESC, COALESCE(active_boosts.val, FALSE) DESC, u.vip_level DESC, (coalesce(cardinality(o.photos), 0) > 0) DESC, u.created_at DESC, u.id DESC';
    }

    const query = `
        SELECT u.id, u.display_name, u.gender, u.role
        FROM users u
        LEFT JOIN operators o ON u.id = o.user_id
        LEFT JOIN LATERAL (SELECT TRUE as val FROM boosts b WHERE b.user_id = u.id AND b.end_time > NOW() LIMIT 1) active_boosts ON TRUE
        ${whereClause}
          AND u.id != $2
          AND u.account_status = 'active'
        ${orderByClause}
        LIMIT $3 OFFSET $4
    `;

    const res = await pool.query(query, [targetGender, userId, limitNum, offset]);
    
    return res.rows.map(row => ({
        sekme: tab,
        sayfa: pageNum,
        id: row.id,
        ad: row.display_name,
        gender: row.gender,
        bayi_mi: row.gender === 'coin_bayisi' || row.role === 'coin_bayisi',
        HATALI_MI: (row.gender !== 'kadin' && row.gender !== 'kadın' && row.gender !== 'female' && row.gender !== 'coin_bayisi')
    }));
}

async function run() {
    try {
        console.log("=== 2) Gerçek DB Çağrıları (API'yi simüle ederek) ===");
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
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
