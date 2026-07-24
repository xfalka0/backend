const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../mobile-app/android/gradle.properties');
if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    content.split('\n').forEach((line, idx) => {
        if (line.includes('hermes') || line.includes('Hermes')) {
            console.log(`${idx + 1}: ${line.trim()}`);
        }
    });
} else {
    console.log('gradle.properties not found.');
}
