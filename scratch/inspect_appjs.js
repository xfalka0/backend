const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../mobile-app/App.js'), 'utf8');
const lines = content.split('\n');

console.log('Searching for Call screens in App.js:');
lines.forEach((line, idx) => {
    if (line.includes('VoiceCall') || line.includes('VideoCall') || line.includes('Screen')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
