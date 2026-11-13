const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'mobile-app') searchFiles(p);
    } else if (f.endsWith('.js')) {
      const code = fs.readFileSync(p, 'utf8');
      const lines = code.split('\n');
      lines.forEach((l, i) => {
        if (l.includes('balance -') || l.includes('balance = balance -') || l.includes('deduct-coins') || l.includes('purchase-xp')) {
          console.log(`${p}:${i+1}: ${l.trim()}`);
        }
      });
    }
  }
}

searchFiles('d:/dating/backend');
