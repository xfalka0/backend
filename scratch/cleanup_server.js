const fs = require('fs');
const path = require('path');

const serverJsPath = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(serverJsPath, 'utf8');
let lines = content.split(/\r?\n/);

// Find the line index for '// --- AGENCY MANAGEMENT ---'
let startIndex = lines.findIndex(line => line.includes('// --- AGENCY MANAGEMENT ---'));
// Find the line index for 'app.post(\'/api/agency/remove-operator\''
let removeOperatorIndex = lines.findIndex(line => line.includes("app.post('/api/agency/remove-operator'"));

if (startIndex === -1 || removeOperatorIndex === -1) {
    console.error('Error: Could not locate agency route blocks.');
    process.exit(1);
}

// Find the closing bracket of the remove-operator route. 
// We know it is followed by '// DEBUG PAYOUT TRACKER' or similar.
let endIndex = -1;
for (let i = removeOperatorIndex; i < lines.length; i++) {
    if (lines[i].includes('// DEBUG PAYOUT TRACKER')) {
        endIndex = i;
        break;
    }
}

if (endIndex === -1) {
    console.error('Error: Could not locate the end of the agency routes block.');
    process.exit(1);
}

console.log(`Removing lines from index ${startIndex} to ${endIndex} (line ${startIndex + 1} to ${endIndex + 1})`);
console.log('Start line content:', lines[startIndex]);
console.log('End line content:', lines[endIndex]);

// Delete the lines and replace them with a single comment line
lines.splice(startIndex, endIndex - startIndex, '// --- AGENCY ROUTING MANAGED EXCLUSIVELY VIA ROUTES/AGENCY.JS ---');

fs.writeFileSync(serverJsPath, lines.join('\n'), 'utf8');
console.log('Successfully cleaned up server.js!');
