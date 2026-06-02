const fs = require('fs');
const path = require('path');

function searchFile(filePath, query) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(query.toLowerCase())) {
      console.log(`${path.basename(filePath)}:${index + 1}: ${line.trim()}`);
    }
  });
}

function searchDir(dirPath, query) {
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        searchDir(fullPath, query);
      }
    } else if (file.endsWith('.js')) {
      searchFile(fullPath, query);
    }
  });
}

const backendDir = path.resolve(__dirname, '..');
console.log('Searching for "agencies" in backend js files...');
searchDir(backendDir, 'agencies');

console.log('\nSearching for "referral_code" in backend js files...');
searchDir(backendDir, 'referral_code');
