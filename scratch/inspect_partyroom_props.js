const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../mobile-app/src/screens/PartyRoomScreen.js'), 'utf8');
const lines = content.split('\n');

console.log('Searching for return statements and render JSX in PartyRoomScreen.js:');
let print = false;
let count = 0;
lines.forEach((line, idx) => {
    if (line.includes('return (') || line.includes('return (')) {
        print = true;
    }
    if (print && count < 60) {
        console.log(`${idx + 1}: ${line}`);
        count++;
    }
    if (line.trim() === '};' && count >= 50) {
        print = false;
    }
});
