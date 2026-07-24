const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../mobile-app/package.json'), 'utf8');
const pkg = JSON.parse(content);
console.log('Dependencies:', Object.keys(pkg.dependencies || {}));
console.log('DevDependencies:', Object.keys(pkg.devDependencies || {}));
