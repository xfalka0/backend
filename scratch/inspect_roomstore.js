const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../mobile-app/src/store/useRoomStore.js'), 'utf8');
const lines = content.split('\n');

console.log('Searching for currentGiftBanner in useRoomStore.js:');
lines.forEach((line, idx) => {
    if (line.includes('currentGiftBanner') || line.includes('setCurrentGiftBanner') || line.includes('gift')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
