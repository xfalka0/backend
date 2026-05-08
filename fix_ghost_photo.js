
const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'dating',
    password: '123',
    port: 5432,
});

async function findAndFix() {
    try {
        console.log('--- HAYALET FOTOĞRAF TEMİZLEME BAŞLADI ---');
        const email = 'c70978036@gmail.com';
        
        // 1. Kullanıcıyı bul
        const userRes = await pool.query("SELECT id, username, avatar_url FROM users WHERE email = $1", [email]);
        
        if (userRes.rows.length === 0) {
            console.log(`HATA: '${email}' e-postasına sahip kullanıcı bulunamadı.`);
            console.log('Veritabanındaki son 5 kullanıcı:');
            const recent = await pool.query("SELECT email FROM users ORDER BY created_at DESC LIMIT 5");
            recent.rows.forEach(r => console.log(' - ' + r.email));
            return;
        }

        const user = userRes.rows[0];
        console.log(`Kullanıcı bulundu: ${user.username} (ID: ${user.id})`);
        console.log(`Mevcut fotoğraf: ${user.avatar_url}`);

        // 2. Fotoğrafı temizle
        await pool.query("UPDATE users SET avatar_url = NULL WHERE id = $1", [user.id]);
        console.log('BAŞARILI: Profil fotoğrafı (avatar_url) temizlendi.');

        // 3. Albümü temizle
        try {
            await pool.query("UPDATE users SET photos = '{}' WHERE id = $1", [user.id]);
            console.log('BAŞARILI: Albüm fotoğrafları temizlendi.');
        } catch (e) {
            console.log('NOT: Albüm tablosu/sütunu bu veritabanında yok, atlanıyor.');
        }

        console.log('--- İŞLEM TAMAMLANDI ---');
        process.exit(0);
    } catch (err) {
        console.error('KRİTİK HATA:', err.message);
        process.exit(1);
    }
}

findAndFix();
