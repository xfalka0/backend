const fs = require('fs');
const path = require('path');

const serverContent = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

console.log('--- Search for app.use ---');
const lines = serverContent.split('\n');
lines.forEach((line, index) => {
    if (line.includes('app.use') || line.includes('userRoutes') || line.includes('/users')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
