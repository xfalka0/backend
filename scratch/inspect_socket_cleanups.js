const fs = require('fs');
const path = require('path');

const checkSocketCleanups = (filePath) => {
    if (!fs.existsSync(filePath)) {
        console.log(`${filePath} does not exist.`);
        return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const filename = path.basename(filePath);
    
    // Find all socket.on or newSocket.on calls
    const onEvents = [];
    const onRegex = /(?:socket|newSocket|SocketService)\.on\(\s*['"`]([^'"`]+)/g;
    let match;
    while ((match = onRegex.exec(content)) !== null) {
        onEvents.push(match[1]);
    }
    
    // Find all socket.off or newSocket.off calls
    const offEvents = [];
    const offRegex = /(?:socket|newSocket|SocketService)\.off\(\s*['"`]([^'"`]+)/g;
    while ((match = offRegex.exec(content)) !== null) {
        offEvents.push(match[1]);
    }
    
    console.log(`\nSocket Events in ${filename}:`);
    console.log(`  Listeners (.on):`, [...new Set(onEvents)]);
    console.log(`  Cleanups (.off):`, [...new Set(offEvents)]);
    
    const missing = onEvents.filter(e => !offEvents.includes(e));
    if (missing.length > 0) {
        console.log(`  ⚠️ Potential missing cleanups for events:`, [...new Set(missing)]);
    } else {
        console.log(`  ✅ All registered socket events seem to have a cleanup (.off) call.`);
    }
};

checkSocketCleanups(path.join(__dirname, '../mobile-app/src/screens/ChatScreen.js'));
checkSocketCleanups(path.join(__dirname, '../mobile-app/src/screens/PartyRoomScreen.js'));
checkSocketCleanups(path.join(__dirname, '../mobile-app/src/screens/VoiceCallScreen.js'));
checkSocketCleanups(path.join(__dirname, '../mobile-app/src/screens/VideoCallScreen.js'));
checkSocketCleanups(path.join(__dirname, '../mobile-app/src/store/useRoomStore.js'));
