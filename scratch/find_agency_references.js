const fs = require('fs');
const path = require('path');

const serverContent = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

console.log('--- Search for agency_id ---');
const lines = serverContent.split('\n');
lines.forEach((line, index) => {
    if (line.includes('agency_id')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
