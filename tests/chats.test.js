// Mock db.query to avoid connecting to the database
jest.mock('../db', () => {
    const mockQuery = jest.fn().mockImplementation(() => Promise.resolve({ rows: [] }));
    return {
        query: mockQuery,
        pool: {
            end: jest.fn().mockResolvedValue(true)
        }
    };
});

// Mock notificationUtils to avoid loading expo-server-sdk ESM dependency in tests
jest.mock('../utils/notificationUtils', () => ({
    sendPushNotification: jest.fn().mockResolvedValue({ success: true })
}));

const request = require('supertest');
const db = require('../db');
const { app } = require('../server');

describe('Chats API Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Explicitly set the default mock implementation to prevent resetMocks from clearing it
        db.query.mockImplementation(() => Promise.resolve({ rows: [] }));
    });

    describe('GET /api/users/:userId/chats', () => {
        it('should return 200 and list chats successfully', async () => {
            const mockChats = [
                {
                    id: 'chat-uuid-1',
                    operator_id: 'operator-uuid',
                    user_id: 'user-uuid',
                    last_message_at: new Date().toISOString(),
                    last_message: 'Selam!',
                    unread_count: 0,
                    name: 'Test Operator',
                    avatar_url: 'https://via.placeholder.com/150',
                    vip_level: 0,
                    is_verified: true,
                    gender: 'kadin',
                    is_online: true
                }
            ];

            // Mock db.query result
            db.query.mockResolvedValueOnce({ rows: mockChats });

            const res = await request(app)
                .get('/api/users/user-uuid/chats')
                .query({ limit: 10, offset: 0 });

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(1);
            expect(res.body[0]).toHaveProperty('id', 'chat-uuid-1');
            expect(res.body[0]).toHaveProperty('operator_id', 'operator-uuid');
            expect(res.body[0]).toHaveProperty('user_id', 'user-uuid');
            expect(res.body[0]).toHaveProperty('name', 'Test Operator');
        });

        it('should handle database errors gracefully', async () => {
            db.query.mockRejectedValueOnce(new Error('Database error'));

            const res = await request(app)
                .get('/api/users/user-uuid/chats');

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty('error', 'Database error');
        });
    });

    describe('GET /api/users/:userId/unread-count', () => {
        it('should return total unread count successfully', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ total_unread: 5 }] });

            const res = await request(app)
                .get('/api/users/user-uuid/unread-count');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('count', 5);
        });
    });
});
