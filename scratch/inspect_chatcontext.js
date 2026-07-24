const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../mobile-app/src/contexts/ChatContext.js'), 'utf8');
const lines = content.split('\n');

console.log('Searching for keywords in ChatContext.js:');
lines.forEach((line, idx) => {
    if (line.includes('incoming_call') || line.includes('VoiceCall') || line.includes('VideoCall')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
