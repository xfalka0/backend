const fs = require('fs');
const path = require('path');

// Mock React Native dependencies virtually to bypass module resolution check
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn().mockResolvedValue('mock-token'),
    setItem: jest.fn().mockResolvedValue(true),
}), { virtual: true });

// Mock Zustand virtually with a lightweight implementation of store creator
jest.mock('zustand', () => ({
    create: (fn) => {
        const store = {
            state: {},
            getState: () => store.state,
            setState: (updater) => {
                const state = typeof updater === 'function' ? updater(store.state) : updater;
                store.state = { ...store.state, ...state };
                Object.assign(store, store.state);
            }
        };
        const initial = fn(
            (updater) => store.setState(updater),
            () => store.getState(),
            store
        );
        store.state = initial;
        Object.assign(store, initial);
        return store;
    }
}), { virtual: true });

jest.mock('axios', () => ({
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
}));

// Mock the mobile config
jest.mock('../mobile-app/src/config', () => ({
    API_URL: 'http://localhost:5000/api',
    SOCKET_URL: 'http://localhost:5000',
}), { virtual: true });

// Mock Socket.io client to prevent actual socket connection attempts
jest.mock('socket.io-client', () => {
    return {
        io: jest.fn().mockReturnValue({
            on: jest.fn(),
            off: jest.fn(),
            emit: jest.fn(),
            disconnect: jest.fn(),
            removeAllListeners: jest.fn(),
            connected: true,
        })
    };
}, { virtual: true });

// Mock the SocketService
jest.mock('../mobile-app/src/services/SocketService', () => ({
    connect: jest.fn().mockResolvedValue(true),
    joinRoom: jest.fn(),
    leaveRoom: jest.fn(),
    on: jest.fn(),
    offAll: jest.fn(),
    sendMessage: jest.fn(),
    sendGift: jest.fn(),
    takeSeat: jest.fn(),
    leaveSeat: jest.fn(),
    toggleSeatMute: jest.fn(),
    lockSeat: jest.fn(),
}), { virtual: true });

// Mock App Store state
jest.mock('../mobile-app/src/store/useAppStore', () => ({
    useAppStore: {
        getState: () => ({
            balance: 500,
            setBalance: jest.fn()
        })
    }
}), { virtual: true });

// Dynamic CommonJS Transpiler to read and run ESM files in Node.js
function loadESMAsCommonJS(relativeFilePath) {
    const absolutePath = path.resolve(__dirname, relativeFilePath);
    let code = fs.readFileSync(absolutePath, 'utf8');

    // Remove or replace ESM imports
    code = code.replace(/import\s+\{\s*create\s*\}\s+from\s+'zustand';/g, "const { create } = require('zustand');");
    code = code.replace(/import\s+AsyncStorage\s+from\s+'@react-native-async-storage\/async-storage';/g, "const AsyncStorage = require('@react-native-async-storage/async-storage');");
    code = code.replace(/import\s+axios\s+from\s+'axios';/g, "const axios = require('axios');");
    code = code.replace(/import\s+\{\s*API_URL\s*\}\s+from\s+'\.\.\/config';/g, "const { API_URL } = require('../mobile-app/src/config');");
    code = code.replace(/import\s+SocketService\s+from\s+'\.\.\/services\/SocketService';/g, "const SocketService = require('../mobile-app/src/services/SocketService');");
    code = code.replace(/import\s+\{\s*useRoomStore\s*\}\s+from\s+'\.\/useRoomStore';/g, "const { useRoomStore } = require('./useRoomStore');");
    code = code.replace(/import\s+SocketService\s+from\s+'\.\.\/\.\.\/services\/SocketService';/g, "const SocketService = require('../mobile-app/src/services/SocketService');");
    code = code.replace(/import\s+\{\s*useGiftStore\s*\}\s+from\s+'\.\.\/store\/useGiftStore';/g, "const { useGiftStore } = require('./useGiftStore');");
    code = code.replace(/import\s+\{\s*useAppStore\s*\}\s+from\s+'\.\.\/store\/useAppStore';/g, "const { useAppStore } = require('./useAppStore');");
    code = code.replace(/import\s+\{\s*useAppStore\s*\}\s+from\s+'\.\/useAppStore';/g, "const { useAppStore } = require('./useAppStore');");

    // Clean any remaining imports
    code = code.replace(/import\s+([a-zA-Z0-9_]+)\s+from\s+'([^']+)';/g, "const $1 = require('$2');");
    code = code.replace(/import\s+\{\s*([^}]+)\s*\}\s+from\s+'([^']+)';/g, "const { $1 } = require('$2');");

    // Replace ESM exports, supporting both local scope declarations and export assignments
    code = code.replace(/export\s+const\s+([a-zA-Z0-9_]+)/g, "const $1 = exports.$1");
    code = code.replace(/export\s+default\s+([a-zA-Z0-9_]+)/g, "module.exports = $1");

    const m = { exports: {} };
    const wrapper = new Function('module', 'exports', 'require', '__dirname', '__filename', code);
    wrapper(m, m.exports, require, path.dirname(absolutePath), absolutePath);
    return m.exports;
}

const axios = require('axios');
const AsyncStorage = require('@react-native-async-storage/async-storage');

// Load stores dynamically
const { useRoomStore } = loadESMAsCommonJS('../mobile-app/src/store/useRoomStore.js');
const { useGiftStore } = loadESMAsCommonJS('../mobile-app/src/store/useGiftStore.js');

describe('Mobile Zustand Stores Flow Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset stores to their initial states
        useRoomStore.setState({
            room: null,
            seats: [],
            messages: [],
            onlineCount: 0,
            isMicEnabled: false,
            isSpeakerEnabled: true,
            currentGiftBanner: null,
            giftBannerQueue: [],
        });
        useGiftStore.setState({
            isVisible: false,
            targetSeat: null,
            gifts: [],
            selectedCategory: 'all',
            isSending: false,
        });
    });

    describe('Room Store State Flows', () => {
        it('should join the room, load details from API and initialize socket', async () => {
            const mockRoom = { id: 'room-123', title: 'Cosmic Chat', host_id: 'host-1' };
            const mockSeats = [{ seat_number: 1, user_id: null }];

            axios.get
                .mockResolvedValueOnce({ data: mockRoom }) // get room details
                .mockResolvedValueOnce({ data: mockSeats }) // get seats details
                .mockResolvedValueOnce({ data: [] }); // get members details

            await useRoomStore.joinRoom('room-123');

            expect(axios.get).toHaveBeenCalledTimes(3);
            expect(useRoomStore.room).toEqual(mockRoom);
            expect(useRoomStore.seats).toEqual(mockSeats);
        });

        it('should update local mic and speaker states', () => {
            expect(useRoomStore.isMicEnabled).toBe(false);
            expect(useRoomStore.isSpeakerEnabled).toBe(true);

            useRoomStore.toggleMic();
            useRoomStore.toggleSpeaker();

            expect(useRoomStore.isMicEnabled).toBe(true);
            expect(useRoomStore.isSpeakerEnabled).toBe(false);
        });

        it('should add messages to the chat history and enforce limit', () => {
            for (let i = 0; i < 110; i++) {
                useRoomStore.addMessage({ id: `m-${i}`, content: `Message ${i}` });
            }

            const messages = useRoomStore.messages;
            expect(messages.length).toBe(100); // Max chat limit enforced
            expect(messages[0].content).toBe('Message 10');
            expect(messages[99].content).toBe('Message 109');
        });
    });

    describe('Gift Store & Banner Queue Flows', () => {
        it('should open gift picker sheet targeting a seat', () => {
            const mockSeat = { seat_number: 3, user_id: 'user-777' };
            
            useGiftStore.openGiftPicker(mockSeat);

            expect(useGiftStore.isVisible).toBe(true);
            expect(useGiftStore.targetSeat).toEqual(mockSeat);
        });

        it('should queue gift banners and slide them sequentially', () => {
            jest.useFakeTimers();

            const gift1 = { giftName: 'Rose', giftIcon: '🌹' };
            const gift2 = { giftName: 'Crown', giftIcon: '👑' };

            useRoomStore.pushGiftBanner(gift1);
            expect(useRoomStore.currentGiftBanner).toEqual(gift1);
            expect(useRoomStore.giftBannerQueue.length).toBe(0);

            useRoomStore.pushGiftBanner(gift2);
            expect(useRoomStore.currentGiftBanner).toEqual(gift1);
            expect(useRoomStore.giftBannerQueue.length).toBe(1);

            // Advance timer for banner duration
            jest.advanceTimersByTime(4000);

            expect(useRoomStore.currentGiftBanner).toEqual(gift2);
            expect(useRoomStore.giftBannerQueue.length).toBe(0);

            jest.advanceTimersByTime(4000);
            expect(useRoomStore.currentGiftBanner).toBeNull();

            jest.useRealTimers();
        });
    });
});
