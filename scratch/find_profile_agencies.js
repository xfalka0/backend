const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../mobile-app/src/screens/ProfileScreen.js'), 'utf8');

console.log('--- Search for Agency/Ajans in ProfileScreen.js ---');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('Agency') || line.includes('Ajans')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
