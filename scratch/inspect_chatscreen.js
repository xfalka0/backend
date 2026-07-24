const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../mobile-app/src/screens/ChatScreen.js'), 'utf8');
const lines = content.split('\n');

console.log('Searching for keywords in ChatScreen.js:');
lines.forEach((line, idx) => {
    if (line.includes('VoiceCall') || line.includes('VideoCall') || line.includes('call_request') || line.includes('call_accept')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
