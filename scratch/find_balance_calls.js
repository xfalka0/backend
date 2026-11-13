const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      if (f !== 'node_modules' && f !== '.git') searchDir(p);
    } else if (f.endsWith('.js') || f.endsWith('.jsx')) {
      const content = fs.readFileSync(p, 'utf8');
      if (content.includes('/balance')) {
        const lines = content.split('\n');
        lines.forEach((l, i) => {
          if (l.includes('/balance')) console.log(path.basename(p) + ':' + (i+1) + ': ' + l.trim());
        });
      }
    }
  }
}

searchDir('d:/dating/backend/mobile-app/src');
