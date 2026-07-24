const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../mobile-app/src/screens/PartyRoomScreen.js'), 'utf8');
const lines = content.split('\n');

console.log('Searching for <FlatList in PartyRoomScreen.js:');
let print = false;
let count = 0;
lines.forEach((line, idx) => {
    if (line.includes('<FlatList')) {
        print = true;
    }
    if (print && count < 60) {
        console.log(`${idx + 1}: ${line}`);
        count++;
    }
    if (line.includes('/>') && count >= 30) {
        print = false;
    }
});
