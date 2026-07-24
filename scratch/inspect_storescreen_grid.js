const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../mobile-app/src/screens/StoreScreen.js'), 'utf8');
const lines = content.split('\n');

console.log('Searching for grid: { in StoreScreen.js:');
lines.forEach((line, idx) => {
    if (line.includes('grid: {') || line.includes('gridCardWrapper: {')) {
        console.log(`${idx + 1}: ${line.trim()}`);
        for(let i=1; i<=6; i++) {
            console.log(`  +${i}: ${lines[idx+i].trim()}`);
        }
    }
});
