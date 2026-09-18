const babel = require('@babel/core');
const fs = require('fs');
const code = fs.readFileSync('d:/dating/backend/web-admin/src/pages/Chats.jsx', 'utf8');
try {
    babel.transformSync(code, { presets: ['@babel/preset-react'] });
    console.log('Syntax OK');
} catch (e) {
    console.error(e.message);
}
