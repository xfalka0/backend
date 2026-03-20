const db = require('./db');
const bcrypt = require('bcrypt');

const createReviewer = async () => {
    try {
        const email = 'reviewer@falkasoft.com';
        const password = 'fiva1234';
        const hashedPassword = await bcrypt.hash(password, 10);
        const username = 'google_reviewer';

        const check = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (check.rows.length > 0) {
            console.log('Test hesabı zaten mevcut.');
            process.exit(0);
        }

        await db.query(
            "INSERT INTO users (username, email, password_hash, role, balance, display_name, avatar_url, onboarding_completed) VALUES ($1, $2, $3, 'user', 9999, 'Google Reviewer', 'https://via.placeholder.com/150', true)",
            [username, email, hashedPassword]
        );

        console.log('Google Play Test Hesabı Başarıyla Oluşturuldu:');
        console.log('E-posta:', email);
        console.log('Şifre:', password);
        process.exit(0);
    } catch (err) {
        console.error('Hata:', err.message);
        process.exit(1);
    }
};

createReviewer();
