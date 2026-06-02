const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

console.log('--- Search for my-invitations in server.js ---');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('my-invitations') || line.includes('invitations')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
