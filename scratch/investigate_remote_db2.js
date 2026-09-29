const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://dating_db_j6yd_user:6sKEcyem8WshFoyHlgJ7FijidmyJAEvC@dpg-d60010ggjchc739mpbcg-a.frankfurt-postgres.render.com/dating_db_j6yd?ssl=true',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("=== 1) gender='kadin' Olan Hesapların Özeti ===");
        const query1 = `
            SELECT 
                u.id, 
                u.display_name, 
                u.gender, 
                u.age, 
                u.created_at,
                (SELECT COUNT(*) FROM pending_photos pp WHERE pp.user_id = u.id AND pp.status = 'approved') as photo_count
            FROM users u
            WHERE u.gender = 'kadin'
        `;
        const res1 = await pool.query(query1);
        
        let age18Count = 0;
        let emptyCount = 0;
        let googleCount = 0;
        let emailCount = 0;
        let phoneCount = 0;
        
        // Let's print out the specific males
        const targetNames = ['SÜL', 'Sezer', 'dursun', 'Berkay Deniz ', 'Yusuf er', 'Hasan', 'Arif ', 'İhsan', 'Mahmut orek', 'Ramo'];
        const targets = res1.rows.filter(r => targetNames.includes(r.display_name));
        console.log("\\n--- Şüpheli Hesaplardan Örnekler ---");
        console.table(targets);

        const dailyDist = {};

        res1.rows.forEach(r => {
            if (r.age == 18) age18Count++;
            if (!r.age) emptyCount++;
            if (r.created_at) {
                const day = r.created_at.toISOString().split('T')[0];
                dailyDist[day] = (dailyDist[day] || 0) + 1;
            }
        });

        console.log("\\n--- İstatistikler ('kadin' Kümesi) ---");
        console.log("Toplam:", res1.rows.length);
        console.log("Yaşı 18 olanlar:", age18Count);
        console.log("Yaşı boş/null olanlar:", emptyCount);
        console.log("Kayıt yolu - Google:", googleCount, "Telefon:", phoneCount, "E-posta/Diğer:", emailCount);
        console.log("Günlük kayıt dağılımı:", dailyDist);

        console.log("\\n=== 2) gender='kadin' Olan Hesaplarda 'relationship', 'interests' Tutarlılığı ===");
        const query2 = `
            SELECT id, display_name, gender, relationship, interests
            FROM users 
            WHERE display_name IN ('SÜL', 'Sezer', 'dursun', 'Berkay Deniz ', 'Yusuf er', 'Hasan', 'Arif ', 'İhsan', 'Mahmut orek')
        `;
        try {
            const res2 = await pool.query(query2);
            console.table(res2.rows);
        } catch (e) {
            console.log("Hata: " + e.message);
        }

        console.log("\\n=== 5) Karşılaştırma İçin: gender='erkek' Kümesinden Örneklem ===");
        const query5 = `
            SELECT 
                u.id, 
                u.display_name, 
                u.gender, 
                u.age, 
                u.created_at
            FROM users u
            WHERE u.gender = 'erkek'
            LIMIT 20
        `;
        const res5 = await pool.query(query5);
        let eAge18Count = 0;
        let eEmptyCount = 0;
        res5.rows.forEach(r => {
            if (r.age == 18) eAge18Count++;
            if (!r.age) eEmptyCount++;
        });
        console.table(res5.rows);
        console.log("Erkek Örneklem İstatistikleri: Toplam", res5.rows.length, "- Yaş 18:", eAge18Count, "- Yaş boş:", eEmptyCount);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
