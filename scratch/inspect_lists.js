const fs = require('fs');
const path = require('path');

const checkList = (filename) => {
    const file = path.join(__dirname, '../mobile-app/src/screens/', filename);
    if (!fs.existsSync(file)) {
        console.log(`${filename} does not exist.`);
        return;
    }
    const content = fs.readFileSync(file, 'utf8');
    console.log(`\nChecking lists in ${filename}:`);
    content.split('\n').forEach((line, idx) => {
        if (line.includes('ScrollView') || line.includes('FlatList') || line.includes('renderItem')) {
            console.log(`  ${idx + 1}: ${line.trim()}`);
        }
    });
};

checkList('StoreScreen.js');
checkList('BagScreen.js');
checkList('VipScreen.js');
checkList('NobilityScreen.js');
