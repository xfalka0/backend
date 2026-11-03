const fs = require('fs');
const path = require('path');
function search(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
        const full = path.join(dir, f.name);
        if (f.isDirectory() && f.name !== 'node_modules') search(full);
        else if (f.isFile() && f.name.endsWith('.js')) {
            const code = fs.readFileSync(full, 'utf8');
            if (/\/api\/users['"`?]/.test(code) || /\${API_URL}\/users['"`?]/.test(code)) {
                console.log('Call in:', full);
            }
        }
    });
}
search('backend/mobile-app/src');

