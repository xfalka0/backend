const fs = require('fs');
const path = require('path');

const roomSeatPath = path.join(__dirname, '../mobile-app/src/components/party-room/RoomSeat.js');
const roomSeatContent = fs.readFileSync(roomSeatPath, 'utf8');
console.log('RoomSeat.js has memo?:', roomSeatContent.includes('memo') || roomSeatContent.includes('React.memo'));

const roomSeatLayoutPath = path.join(__dirname, '../mobile-app/src/components/party-room/RoomSeatLayout.js');
const roomSeatLayoutContent = fs.readFileSync(roomSeatLayoutPath, 'utf8');
console.log('RoomSeatLayout.js has memo?:', roomSeatLayoutContent.includes('memo') || roomSeatLayoutContent.includes('React.memo'));

const partyRoomScreenPath = path.join(__dirname, '../mobile-app/src/screens/PartyRoomScreen.js');
const partyRoomScreenContent = fs.readFileSync(partyRoomScreenPath, 'utf8');
console.log('PartyRoomScreen.js has useCallback?:', partyRoomScreenContent.includes('useCallback'));
console.log('PartyRoomScreen.js has useMemo?:', partyRoomScreenContent.includes('useMemo'));
