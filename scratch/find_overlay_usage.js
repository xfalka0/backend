const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'build') searchDir(p);
    } else if (f.endsWith('.js') || f.endsWith('.java') || f.endsWith('.xml')) {
      const content = fs.readFileSync(p, 'utf8');
      if (content.includes('SYSTEM_ALERT_WINDOW') || content.includes('canDrawOverlays')) {
        console.log(p + ': contains overlay reference');
      }
    }
  }
}

searchDir('d:/dating/backend/mobile-app');
