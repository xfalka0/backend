const fs = require('fs');
const path = require('path');

const checkChatLists = (filePath) => {
    if (!fs.existsSync(filePath)) {
        console.log(`${filePath} does not exist.`);
        return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`\nChecking lists in ${path.basename(filePath)}:`);
    content.split('\n').forEach((line, idx) => {
        if (line.includes('ScrollView') || line.includes('FlatList') || line.includes('renderItem') || line.includes('messages')) {
            if (line.includes('List') || line.includes('View') || line.includes('map')) {
                console.log(`  ${idx + 1}: ${line.trim()}`);
            }
        }
    });
};

checkChatLists(path.join(__dirname, '../mobile-app/src/screens/ChatScreen.js'));
checkChatLists(path.join(__dirname, '../mobile-app/src/screens/PartyRoomScreen.js'));
