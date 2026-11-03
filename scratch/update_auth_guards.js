const fs = require('fs');
let code = fs.readFileSync('backend/mobile-app/src/screens/AuthScreen.js', 'utf8');

const oldEmailAuth = 'const handleEmailAuth = async () => {\n        if (!email || !password) {';
const newEmailAuth = `const handleEmailAuth = async () => {
        if (isRegisterMode && !consentChecked) {
            setAlert({ visible: true, title: 'Onay Zorunludur ⚠️', message: 'Kayıt olabilmek için Kullanım Şartları ve Gizlilik Politikasını onaylamanız gerekmektedir.', type: 'warning' });
            return;
        }
        if (!email || !password) {`;

const oldReqOtp = 'const handleRequestOtp = async () => {\n        let identifier = authMethod';
const newReqOtp = `const handleRequestOtp = async () => {
        if (!consentChecked) {
            setAlert({ visible: true, title: 'Onay Zorunludur ⚠️', message: 'Devam edebilmek için Kullanım Şartları ve Gizlilik Politikasını onaylamanız gerekmektedir.', type: 'warning' });
            return;
        }
        let identifier = authMethod`;

if (code.includes(oldEmailAuth)) code = code.replace(oldEmailAuth, newEmailAuth);
if (code.includes(oldReqOtp)) code = code.replace(oldReqOtp, newReqOtp);

fs.writeFileSync('backend/mobile-app/src/screens/AuthScreen.js', code, 'utf8');
console.log('Added guard to handleEmailAuth and handleRequestOtp');

