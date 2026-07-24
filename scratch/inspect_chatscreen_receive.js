const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../mobile-app/src/screens/ChatScreen.js'), 'utf8');
const lines = content.split('\n');

console.log('Searching for receive_message or incoming gift handling in ChatScreen.js:');
lines.forEach((line, idx) => {
    if (line.includes('receive_message') || line.includes('gift_id') || line.includes('content_type === \'gift\'')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
