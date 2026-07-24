const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../mobile-app/src/screens/ExploreScreen.js'), 'utf8');
const lines = content.split('\n');

console.log('Searching for list components (ScrollView/FlatList) in ExploreScreen.js:');
lines.forEach((line, idx) => {
    if (line.includes('ScrollView') || line.includes('FlatList') || line.includes('renderItem')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
