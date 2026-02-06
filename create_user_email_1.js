const db = require('./db');
const bcrypt = require('bcrypt');

async function createUser() {
    try {
        const email = '1';
        const password = '1';
        const hashedPassword = await bcrypt.hash(password, 10);
        const username = 'user_' + Date.now();

        const result = await db.query(
            `INSERT INTO users (username, email, password_hash, role, balance, display_name, avatar_url) 
             VALUES ($1, $2, $3, 'user', 100, $4, 'https://via.placeholder.com/150') 
             RETURNING *`,
            [username, email, hashedPassword, 'User 1']
        );

        console.log('✅ Kullanıcı başarıyla oluşturuldu!');
        console.log('\nGiriş Bilgileri:');
        console.log('Email: 1');
        console.log('Şifre: 1');
        console.log('\nKullanıcı ID:', result.rows[0].id);
        console.log('Username:', result.rows[0].username);

    } catch (error) {
        console.error('❌ Hata:', error.message);
    } finally {
        process.exit();
    }
}

createUser();
