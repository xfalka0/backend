const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const files = [
    '../mobile-app/App.js',
    '../mobile-app/src/store/useAppStore.js',
    '../mobile-app/src/services/SocketService.js',
    '../mobile-app/src/components/party-room/RoomSeat.js',
    '../mobile-app/src/components/party-room/RoomSeatLayout.js',
    '../mobile-app/src/screens/PartyRoomScreen.js',
    '../mobile-app/src/screens/BagScreen.js',
    '../mobile-app/src/screens/StoreScreen.js',
    '../mobile-app/src/components/animated/GiftOverlay.js',
    '../mobile-app/src/components/party-room/GiftAnimationOverlay.js'
];

files.forEach(relPath => {
    const fullPath = path.join(__dirname, relPath);
    if (!fs.existsSync(fullPath)) {
        console.log(`❌ File not found: ${relPath}`);
        return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    try {
        parser.parse(content, {
            sourceType: 'module',
            plugins: ['jsx', 'classProperties', 'objectRestSpread', 'dynamicImport']
        });
        console.log(`✅ Syntax OK: ${relPath}`);
    } catch (err) {
        console.log(`❌ Syntax ERROR in ${relPath}:`);
        console.log(`   Line ${err.loc?.line}, Column ${err.loc?.column}: ${err.message}`);
    }
});
