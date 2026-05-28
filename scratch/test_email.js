const nodemailer = require('nodemailer');
require('dotenv').config();

const testEmail = async () => {
    const emailUser = process.env.EMAIL_USER;
    // Clean spaces if any
    const emailPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : '';

    console.log('--- SMTP Diagnostic Test ---');
    console.log('EMAIL_USER:', emailUser || 'MISSING');
    console.log('EMAIL_PASS length:', emailPass ? emailPass.length : 0);

    if (!emailUser || !emailPass) {
        console.error('ERROR: EMAIL_USER or EMAIL_PASS is missing in your .env file!');
        process.exit(1);
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });

    try {
        console.log('Verifying SMTP connection details...');
        await transporter.verify();
        console.log('SUCCESS: SMTP connection successfully verified!');

        console.log('Attempting to send a test email to yourself...');
        const info = await transporter.sendMail({
            from: `"Fiva Test" <${emailUser}>`,
            to: emailUser,
            subject: 'Fiva SMTP Doğrulama Testi',
            text: 'Tebrikler! Fiva e-posta SMTP kurulumunuz tamamen sorunsuz çalışıyor.',
            html: '<b>Tebrikler!</b> Fiva e-posta SMTP kurulumunuz tamamen sorunsuz çalışıyor.'
        });

        console.log('SUCCESS: Test email sent successfully! Message ID:', info.messageId);
    } catch (err) {
        console.error('--- DIAGNOSTIC ERROR DETAILS ---');
        console.error('Code:', err.code);
        console.error('Response:', err.response);
        console.error('Message:', err.message);
        console.error('Stack:', err.stack);
        console.error('--------------------------------');
        
        console.log('\n--- Common Solutions ---');
        if (err.message.includes('Invalid login') || err.message.includes('Username and Password not accepted')) {
            console.log('👉 HATA: Şifreniz veya e-posta adresiniz yanlış.');
            console.log('👉 ÇÖZÜM: 16 haneli Google Uygulama Şifrenizi kopyalarken aradaki boşlukları tamamen sildiğinizden emin olun (Örn: abcd efgh ijkl mnop yerine abcdefghijklmnop).');
            console.log('👉 ÇÖZÜM: Gmail hesabınızda 2 Adımlı Doğrulamanın açık olduğundan emin olun.');
        } else if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
            console.log('👉 HATA: Sunucudan Google sunucularına erişilirken zaman aşımı oldu.');
            console.log('👉 ÇÖZÜM: Bulunduğunuz yerdeki veya sunucunun (Render) ağ ayarları veya güvenlik duvarı SMTP portlarını engelliyor olabilir.');
        }
    }
};

testEmail();
