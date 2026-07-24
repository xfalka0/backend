const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '../mobile-app/app.json');
if (fs.existsSync(appJsonPath)) {
    const content = fs.readFileSync(appJsonPath, 'utf8');
    console.log('Hermes in app.json:', content.includes('"hermes"') || content.includes('hermes'));
}

const buildGradlePath = path.join(__dirname, '../mobile-app/android/app/build.gradle');
if (fs.existsSync(buildGradlePath)) {
    const content = fs.readFileSync(buildGradlePath, 'utf8');
    const lines = content.split('\n');
    console.log('Hermes lines in build.gradle:');
    lines.forEach((line, idx) => {
        if (line.includes('hermesEnabled') || line.includes('enableHermes')) {
            console.log(`  ${idx + 1}: ${line.trim()}`);
        }
    });
}
