const babel = require('@babel/core');
const fs = require('fs');

const code = fs.readFileSync('d:/dating/backend/web-admin/src/pages/Chats.jsx', 'utf8');
const lines = code.split('\n');

for (let i = 1; i <= lines.length; i++) {
    const chunk = lines.slice(0, i).join('\n') + '\nreturn <div />; }; export default Chats;';
    try {
        babel.transformSync(chunk, { presets: ['@babel/preset-react'] });
    } catch (e) {
        if (!e.message.includes("'import' and 'export' may only appear at the top level") && 
            !e.message.includes("Unexpected token, expected") && 
            !e.message.includes("Unterminated string constant")) {
            console.log('Error at line', i, ':', e.message);
            process.exit(1);
        } else if (e.message.includes("Unexpected token, expected \",\"")) {
            console.log('Found unexpected token at line', i);
            console.log(e.message);
            process.exit(1);
        }
    }
}
console.log('Done');
