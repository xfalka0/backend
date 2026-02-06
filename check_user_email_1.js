const db = require('./db');
const bcrypt = require('bcrypt');

async function checkUser() {
    try {
        const email = '1';

        // Check if user exists
        const result = await db.query('SELECT id, username, email, password_hash, created_at FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            console.log('❌ Email "1" ile kayıtlı kullanıcı bulunamadı.');
            console.log('\nYeni kullanıcı oluşturmak ister misin? (create_user_with_email_1.js)');
        } else {
            const user = result.rows[0];
            console.log('✅ Kullanıcı bulundu!');
            console.log('ID:', user.id);
            console.log('Username:', user.username);
            console.log('Email:', user.email);
            console.log('Created:', user.created_at);

            // Test password "1"
            const testPassword = '1';
            const isValid = await bcrypt.compare(testPassword, user.password_hash);

            if (isValid) {
                console.log('\n✅ Şifre "1" DOĞRU!');
                console.log('Bu bilgilerle giriş yapabilirsin:');
                console.log('Email: 1');
                console.log('Şifre: 1');
            } else {
                console.log('\n❌ Şifre "1" YANLIŞ!');
                console.log('Bu kullanıcının şifresi farklı.');
            }
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        process.exit();
    }
}

checkUser();
