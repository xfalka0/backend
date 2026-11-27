const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../db', () => ({
    query: jest.fn(),
    pool: {
        connect: jest.fn(),
        end: jest.fn().mockResolvedValue(true),
    },
}));

jest.mock('../utils/notificationUtils', () => ({
    sendPushNotification: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../services/aiChatService', () => ({
    processAiAutoReply: jest.fn().mockResolvedValue(false),
    scheduleAiNumaraHook: jest.fn().mockResolvedValue(false),
}));

jest.mock('../utils/commissionUtils', () => ({
    recordOperatorCommission: jest.fn().mockResolvedValue(null),
}));

jest.mock('../utils/helpers', () => {
    const actual = jest.requireActual('../utils/helpers');
    return {
        ...actual,
        logFreeMessagesExhausted: jest.fn().mockResolvedValue(true),
    };
});

// Virtual mocks for mobile useAppStore loading
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn().mockResolvedValue('mock-token'),
    setItem: jest.fn().mockResolvedValue(true),
    multiGet: jest.fn().mockResolvedValue([]),
    multiSet: jest.fn().mockResolvedValue(true),
    removeItem: jest.fn().mockResolvedValue(true),
}), { virtual: true });

jest.mock('expo-device', () => ({
    totalMemory: 6 * 1024 * 1024 * 1024,
}), { virtual: true });

jest.mock('zustand', () => ({
    create: (fn) => {
        const store = {
            state: {},
            getState: () => store.state,
            setState: (updater) => {
                const state = typeof updater === 'function' ? updater(store.state) : updater;
                store.state = { ...store.state, ...state };
                Object.assign(store, store.state);
            },
        };
        const initial = fn(
            (updater) => store.setState(updater),
            () => store.getState(),
            store
        );
        store.state = initial;
        Object.assign(store, initial);
        return store;
    },
}), { virtual: true });

jest.mock('axios', () => ({
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
}));

jest.mock('../mobile-app/src/config', () => ({
    API_URL: 'http://localhost:5000/api',
}), { virtual: true });

const db = require('../db');
const { initializeSockets } = require('../socket/socketHandler');
const messageRoutes = require('../routes/messageRoutes');
const { SECRET_KEY } = require('../middleware/auth');
const { processAiAutoReply, scheduleAiNumaraHook } = require('../services/aiChatService');
const { logFreeMessagesExhausted } = require('../utils/helpers');

function loadAppStore() {
    const absPath = path.resolve(__dirname, '../mobile-app/src/store/useAppStore.js');
    let code = fs.readFileSync(absPath, 'utf8');
    code = code.replace(/import\s+\{\s*create\s*\}\s+from\s+'zustand';/g, "const { create } = require('zustand');");
    code = code.replace(/import\s+AsyncStorage\s+from\s+'@react-native-async-storage\/async-storage';/g, "const AsyncStorage = require('@react-native-async-storage/async-storage');");
    code = code.replace(/import\s+axios\s+from\s+'axios';/g, "const axios = require('axios');");
    code = code.replace(/import\s+\*\s+as\s+Device\s+from\s+'expo-device';/g, "const Device = require('expo-device');");
    code = code.replace(/import\s+\{\s*API_URL\s*\}\s+from\s+'\.\.\/config';/g, "const { API_URL } = require('../mobile-app/src/config');");
    code = code.replace(/export\s+const\s+([a-zA-Z0-9_]+)/g, 'const $1 = exports.$1');

    const m = { exports: {} };
    const wrapper = new Function('module', 'exports', 'require', '__dirname', '__filename', code);
    wrapper(m, m.exports, require, path.dirname(absPath), absPath);
    return m.exports;
}

describe('Female customer coin billing parity (same as male)', () => {
    let roomEmits;
    let mockIo;
    let registeredHandlers;
    let mockSocket;

    function createSocketHarness(socketUser) {
        roomEmits = {};
        registeredHandlers = {};

        mockIo = {
            on: jest.fn((event, cb) => {
                if (event === 'connection') {
                    mockSocket = {
                        id: 'sock-1',
                        user: socketUser,
                        join: jest.fn(),
                        leave: jest.fn(),
                        emit: jest.fn(),
                        to: jest.fn(() => ({ emit: jest.fn() })),
                        on: jest.fn((ev, handler) => {
                            registeredHandlers[ev] = handler;
                        }),
                    };
                    cb(mockSocket);
                }
            }),
            to: jest.fn((room) => {
                if (!roomEmits[room]) roomEmits[room] = [];
                return {
                    emit: jest.fn((ev, payload) => {
                        roomEmits[room].push({ ev, payload });
                    }),
                };
            }),
            emit: jest.fn(),
        };

        initializeSockets(mockIo);
    }

    beforeEach(() => {
        jest.clearAllMocks();
        db.query.mockResolvedValue({ rows: [] });
        processAiAutoReply.mockResolvedValue(false);
        scheduleAiNumaraHook.mockResolvedValue(false);
        logFreeMessagesExhausted.mockResolvedValue(true);
    });

    it('blocks a 0-coin female customer (role=user, gender=kadin) from sending messages over socket', async () => {
        createSocketHarness({
            id: 101,
            username: 'serhat_f',
            role: 'user',
            gender: 'kadin',
        });

        const queries = [];
        const mockClient = {
            query: jest.fn(async (sql, params) => {
                queries.push({ sql, params });
                if (sql.includes('FROM chats c')) {
                    return {
                        rows: [{
                            user_id: 101,
                            operator_id: 202,
                            user_gender: 'kadin',
                            operator_gender: 'erkek',
                            user_role: 'user',
                            operator_role: 'operator',
                            operator_managed_by: null,
                        }],
                    };
                }
                if (sql.includes('SELECT balance, role')) {
                    return {
                        rows: [{
                            balance: 0,
                            role: 'user',
                            is_vip: false,
                            is_premium: false,
                            premium_expire_date: null,
                            vip_expire_date: null,
                            vip_level: 0,
                        }],
                    };
                }
                return { rows: [] };
            }),
            release: jest.fn(),
        };
        db.pool.connect.mockResolvedValue(mockClient);

        await registeredHandlers['send_message']({
            chatId: 55,
            content: 'Numaranı yaz',
            type: 'text',
            tempId: 'tmp-zero-coin',
        });

        expect(roomEmits['sock-1']).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    ev: 'message_error',
                    payload: expect.objectContaining({
                        code: 'INSUFFICIENT_FUNDS',
                        required: 10,
                        tempId: 'tmp-zero-coin',
                    }),
                }),
            ])
        );
        expect(roomEmits['55']).toBeUndefined();
        expect(queries.some((q) => q.sql.includes('INSERT INTO messages'))).toBe(false);
        expect(queries.some((q) => q.sql.includes('ROLLBACK'))).toBe(true);
    });

    it('deducts 10 coins when a female customer (role=user, gender=kadin) sends a text message', async () => {
        createSocketHarness({
            id: 101,
            username: 'female_cust',
            role: 'user',
            gender: 'kadin',
        });

        const queries = [];
        const mockClient = {
            query: jest.fn(async (sql, params) => {
                queries.push({ sql, params });
                if (sql.includes('FROM chats c')) {
                    return {
                        rows: [{
                            user_id: 101,
                            operator_id: 202,
                            user_gender: 'kadin',
                            operator_gender: 'erkek',
                            user_role: 'user',
                            operator_role: 'operator',
                            operator_managed_by: null,
                        }],
                    };
                }
                if (sql.includes('SELECT balance, role')) {
                    return {
                        rows: [{
                            balance: 50,
                            role: 'user',
                            is_vip: false,
                            is_premium: false,
                            premium_expire_date: null,
                            vip_expire_date: null,
                            vip_level: 0,
                        }],
                    };
                }
                if (sql.includes('UPDATE users SET balance = balance - $2')) {
                    return { rows: [{ balance: 40 }] };
                }
                if (sql.includes('INSERT INTO messages')) {
                    return {
                        rows: [{
                            id: 9001,
                            chat_id: 55,
                            sender_id: 101,
                            content: 'Merhaba',
                            content_type: 'text',
                            created_at: new Date().toISOString(),
                        }],
                    };
                }
                if (sql.includes('SELECT display_name, username')) {
                    return { rows: [{ display_name: 'Ayşe', username: 'ayse', avatar_url: null }] };
                }
                return { rows: [] };
            }),
            release: jest.fn(),
        };
        db.pool.connect.mockResolvedValue(mockClient);

        await registeredHandlers['send_message']({
            chatId: 55,
            content: 'Merhaba',
            type: 'text',
            tempId: 'tmp-deduct-coin',
        });

        expect(queries.some((q) => q.sql.includes('UPDATE users SET balance = balance - $2') && q.params[1] === 10)).toBe(true);
        expect(queries.some((q) => q.sql.includes('INSERT INTO transactions'))).toBe(true);
        expect(mockSocket.emit).toHaveBeenCalledWith('balance_update', { userId: 101, newBalance: 40 });
        expect((roomEmits['sock-1'] || []).some((e) => e.ev === 'message_error')).toBe(false);
        expect(roomEmits['55']).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    ev: 'receive_message',
                    payload: expect.objectContaining({
                        id: 9001,
                        content: 'Merhaba',
                        tempId: 'tmp-deduct-coin',
                    }),
                }),
            ])
        );
    });

    it('keeps operator accounts (role=operator, gender=kadin) free when replying', async () => {
        createSocketHarness({
            id: 202,
            username: 'op_cemre',
            role: 'operator',
            gender: 'kadin',
        });

        const queries = [];
        const mockClient = {
            query: jest.fn(async (sql, params) => {
                queries.push({ sql, params });
                if (sql.includes('FROM chats c')) {
                    return {
                        rows: [{
                            user_id: 101,
                            operator_id: 202,
                            user_gender: 'erkek',
                            operator_gender: 'kadin',
                            user_role: 'user',
                            operator_role: 'operator',
                            operator_managed_by: null,
                        }],
                    };
                }
                if (sql.includes('INSERT INTO messages')) {
                    return {
                        rows: [{
                            id: 9002,
                            chat_id: 55,
                            sender_id: 202,
                            content: 'Selam tatlım',
                            content_type: 'text',
                            created_at: new Date().toISOString(),
                        }],
                    };
                }
                if (sql.includes('SELECT display_name, username')) {
                    return { rows: [{ display_name: 'Cemre', username: 'op_cemre', avatar_url: null }] };
                }
                return { rows: [] };
            }),
            release: jest.fn(),
        };
        db.pool.connect.mockResolvedValue(mockClient);

        await registeredHandlers['send_message']({
            chatId: 55,
            content: 'Selam tatlım',
            type: 'text',
            tempId: 'tmp-op-reply',
        });

        expect(queries.some((q) => q.sql.includes('UPDATE users SET balance = balance -'))).toBe(false);
        expect(roomEmits['55']).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ ev: 'receive_message' }),
            ])
        );
    });

    it('requires premium/coins on call_request for regular female users just like males', async () => {
        createSocketHarness({
            id: 101,
            username: 'female_cust',
            role: 'user',
            gender: 'kadin',
        });

        db.query.mockImplementation(async (sql) => {
            if (sql.includes('SELECT user_id, operator_id FROM chats')) {
                return { rows: [{ user_id: 101, operator_id: 202 }] };
            }
            if (sql.includes('SELECT balance, role, display_name, gender')) {
                return {
                    rows: [{
                        balance: 0,
                        role: 'user',
                        display_name: 'Serhat',
                        gender: 'kadin',
                        is_premium: false,
                        premium_expire_date: null,
                        vip_expire_date: null,
                    }],
                };
            }
            return { rows: [] };
        });

        await registeredHandlers['call_request']({
            chatId: 55,
            receiverId: 202,
            callType: 'audio',
        });

        expect(mockSocket.emit).toHaveBeenCalledWith('call_error', {
            message: 'Sesli ve görüntülü arama yapmak için Premium üye olmanız gerekmektedir.',
        });
    });

    it('enforces coin checks on POST /api/messages REST fallback for 0-coin female users', async () => {
        const app = express();
        app.use(express.json());
        app.set('io', { emit: jest.fn(), to: jest.fn(() => ({ emit: jest.fn() })) });
        app.use('/api/messages', messageRoutes);

        const token = jwt.sign({ id: 101, role: 'user' }, SECRET_KEY);

        db.query.mockImplementation(async (sql) => {
            if (sql.includes('FROM users WHERE id::text')) {
                return {
                    rows: [{
                        id: 101,
                        username: 'female_cust',
                        role: 'user',
                        account_status: 'active',
                        gender: 'kadin',
                    }],
                };
            }
            return { rows: [] };
        });

        const mockClient = {
            query: jest.fn(async (sql) => {
                if (sql.includes('SELECT balance, role')) {
                    return {
                        rows: [{
                            balance: 0,
                            role: 'user',
                            is_premium: false,
                            premium_expire_date: null,
                            vip_expire_date: null,
                        }],
                    };
                }
                return { rows: [] };
            }),
            release: jest.fn(),
        };
        db.pool.connect.mockResolvedValue(mockClient);

        const res = await request(app)
            .post('/api/messages')
            .set('Authorization', `Bearer ${token}`)
            .send({ chatId: 55, content: 'Merhaba 👋', type: 'text' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('insufficientFunds', true);
    });

    it('treats female role=user accounts as customer (coin balance) in mobile useAppStore', () => {
        const { useAppStore } = loadAppStore();

        useAppStore.getState().setUser({
            id: 101,
            role: 'user',
            gender: 'kadin',
            balance: 70,
            pending_balance: 0,
        });
        expect(useAppStore.getState().role).toBe('customer');
        expect(useAppStore.getState().balance).toBe(70);

        useAppStore.getState().setUser({
            id: 202,
            role: 'operator',
            gender: 'kadin',
            balance: 0,
            pending_balance: 500,
        });
        expect(useAppStore.getState().role).toBe('operator');
        expect(useAppStore.getState().balance).toBe(500);
    });
});
