const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../mobile-app/src/screens/PartyRoomScreen.js'), 'utf8');
const lines = content.split('\n');

console.log('Searching for currentGiftBanner in PartyRoomScreen.js:');
lines.forEach((line, idx) => {
    if (line.includes('currentGiftBanner') || line.includes('setCurrentGiftBanner')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
