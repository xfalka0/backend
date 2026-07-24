const fs = require('fs');
const path = require('path');

const checkModalLists = (filePath) => {
    if (!fs.existsSync(filePath)) {
        console.log(`${filePath} does not exist.`);
        return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`\nChecking lists in ${path.basename(filePath)}:`);
    content.split('\n').forEach((line, idx) => {
        if (line.includes('ScrollView') || line.includes('FlatList') || line.includes('renderItem')) {
            console.log(`  ${idx + 1}: ${line.trim()}`);
        }
    });
};

checkModalLists(path.join(__dirname, '../mobile-app/src/components/party-room/RoomMembersPanel.js'));
checkModalLists(path.join(__dirname, '../mobile-app/src/components/GiftPickerModal.js'));
checkModalLists(path.join(__dirname, '../mobile-app/src/components/party-room/RoomBottomBar.js'));
