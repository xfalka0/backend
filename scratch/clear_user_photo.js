
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: "postgresql://postgres:123@localhost:5432/dating"
});

async function clearPhoto() {
    try {
        const email = 'c70978036@gmail.com';
        const res = await pool.query("UPDATE users SET avatar_url = NULL WHERE email = $1", [email]);
        console.log(`Bitti! ${res.rowCount} kullanıcı güncellendi.`);
        
        // Ayrıca albumden de temizleyelim
        const albumRes = await pool.query("UPDATE users SET photos = '{}' WHERE email = $1", [email]);
        console.log(`Albüm de temizlendi: ${albumRes.rowCount} kullanıcı.`);
        
        process.exit(0);
    } catch (err) {
        console.error('Hata:', err.message);
        process.exit(1);
    }
}

clearPhoto();
