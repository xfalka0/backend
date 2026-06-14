// Mock db.query to avoid connecting to the database
jest.mock('../db', () => {
    const mockQuery = jest.fn().mockImplementation((sql, params) => {
        if (sql && sql.includes('FROM users WHERE id')) {
            return Promise.resolve({
                rows: [{
                    id: 'user-uuid',
                    username: 'testuser',
                    email: 'test@example.com',
                    role: 'user',
                    account_status: 'active',
                    display_name: 'Test User',
                    avatar_url: 'https://via.placeholder.com/150',
                    gender: 'erkek',
                    onboarding_completed: true
                }]
            });
        }
        return Promise.resolve({ rows: [] });
    });
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
const jwt = require('jsonwebtoken');

describe('Chats API Tests', () => {
    let mockToken;

    beforeAll(() => {
        mockToken = jwt.sign({ id: 'user-uuid', email: 'test@example.com', role: 'user' }, process.env.JWT_SECRET || 'testsecret');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        db.query.mockImplementation((sql, params) => {
            if (sql && sql.includes('FROM users WHERE id')) {
                return Promise.resolve({
                    rows: [{
                        id: 'user-uuid',
                        username: 'testuser',
                        email: 'test@example.com',
                        role: 'user',
                        account_status: 'active',
                        display_name: 'Test User',
                        avatar_url: 'https://via.placeholder.com/150',
                        gender: 'erkek',
                        onboarding_completed: true
                    }]
                });
            }
            return Promise.resolve({ rows: [] });
        });
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

            // Setup mock implementation specifically for the chats query
            db.query.mockImplementation((sql, params) => {
                if (sql && sql.includes('FROM users WHERE id')) {
                    return Promise.resolve({
                        rows: [{
                            id: 'user-uuid',
                            username: 'testuser',
                            email: 'test@example.com',
                            role: 'user',
                            account_status: 'active',
                            display_name: 'Test User',
                            avatar_url: 'https://via.placeholder.com/150',
                            gender: 'erkek',
                            onboarding_completed: true
                        }]
                    });
                }
                if (sql && sql.includes('chats')) {
                    return Promise.resolve({ rows: mockChats });
                }
                return Promise.resolve({ rows: [] });
            });

            const res = await request(app)
                .get('/api/users/user-uuid/chats')
                .set('Authorization', `Bearer ${mockToken}`)
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
            db.query.mockImplementation((sql, params) => {
                if (sql && sql.includes('FROM users WHERE id')) {
                    return Promise.resolve({
                        rows: [{
                            id: 'user-uuid',
                            username: 'testuser',
                            role: 'user',
                            account_status: 'active'
                        }]
                    });
                }
                return Promise.reject(new Error('Database error'));
            });

            const res = await request(app)
                .get('/api/users/user-uuid/chats')
                .set('Authorization', `Bearer ${mockToken}`);

            expect(res.status).toBe(500);
            expect(res.body).toHaveProperty('error', 'Database error');
        });
    });

    describe('GET /api/users/:userId/unread-count', () => {
        it('should return total unread count successfully', async () => {
            db.query.mockImplementation((sql, params) => {
                if (sql && sql.includes('FROM users WHERE id')) {
                    return Promise.resolve({
                        rows: [{
                            id: 'user-uuid',
                            username: 'testuser',
                            role: 'user',
                            account_status: 'active'
                        }]
                    });
                }
                if (sql && sql.includes('unread')) {
                    return Promise.resolve({ rows: [{ total_unread: 5 }] });
                }
                return Promise.resolve({ rows: [] });
            });

            const res = await request(app)
                .get('/api/users/user-uuid/unread-count')
                .set('Authorization', `Bearer ${mockToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('count', 5);
        });
    });
});
