const fs = require('fs');
const path = require('path');

const findInsertLine = (filePath, componentName) => {
    if (!fs.existsSync(filePath)) {
        console.log(`${filePath} does not exist.`);
        return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    console.log(`\nLines for ${componentName} in ${path.basename(filePath)}:`);
    lines.forEach((line, idx) => {
        if (line.includes(`export default function ${componentName}`) || line.includes(`const ${componentName} =`)) {
            console.log(`  ${idx + 1}: ${line.trim()}`);
            for (let i = 1; i <= 6; i++) {
                if (lines[idx + i]) {
                    console.log(`    +${i}: ${lines[idx + i].trim()}`);
                }
            }
        }
    });
};

findInsertLine(path.join(__dirname, '../mobile-app/src/screens/PartyRoomScreen.js'), 'PartyRoomScreen');
findInsertLine(path.join(__dirname, '../mobile-app/src/components/party-room/RoomSeatLayout.js'), 'RoomSeatLayout');
findInsertLine(path.join(__dirname, '../mobile-app/src/components/party-room/RoomSeat.js'), 'RoomSeat');
findInsertLine(path.join(__dirname, '../mobile-app/src/screens/ExploreScreen.js'), 'ExploreScreen');
findInsertLine(path.join(__dirname, '../mobile-app/src/screens/ProfileScreen.js'), 'ProfileScreen');
findInsertLine(path.join(__dirname, '../mobile-app/src/screens/ChatScreen.js'), 'ChatScreen');
findInsertLine(path.join(__dirname, '../mobile-app/src/screens/StoreScreen.js'), 'StoreScreen');
findInsertLine(path.join(__dirname, '../mobile-app/src/screens/VipScreen.js'), 'VipScreen');
findInsertLine(path.join(__dirname, '../mobile-app/src/screens/NobilityScreen.js'), 'NobilityScreen');
