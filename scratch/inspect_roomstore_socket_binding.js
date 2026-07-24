const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../mobile-app/src/store/useRoomStore.js'), 'utf8');
const lines = content.split('\n');

console.log('Searching for Socket listener setup/cleanup in useRoomStore.js:');
let inSocketBind = false;
lines.forEach((line, idx) => {
    if (line.includes('connectSocket') || line.includes('disconnectSocket') || line.includes('setupSocket') || line.includes('SocketService.on') || line.includes('SocketService.off')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
