// Mock db.query to avoid connecting to the database
jest.mock('../db', () => {
    const mockQuery = jest.fn().mockImplementation((sql, params) => {
        if (sql && sql.includes('FROM users WHERE id')) {
            return Promise.resolve({
                rows: [{
                    id: 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b',
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
            connect: jest.fn(),
            end: jest.fn().mockResolvedValue(true)
        }
    };
});

jest.mock('../utils/notificationUtils', () => ({
    sendPushNotification: jest.fn().mockResolvedValue({ success: true })
}));

const request = require('supertest');
const db = require('../db');
const { app } = require('../server');
const jwt = require('jsonwebtoken');

describe('Party Rooms REST API Tests', () => {
    let mockToken;
    const mockUser = { id: 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b', email: 'test@example.com', role: 'user' };

    beforeAll(() => {
        mockToken = jwt.sign(mockUser, process.env.JWT_SECRET || 'testsecret');
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Ensure db.pool.connect returns a valid mock client even after clearAllMocks
        const mockClient = {
            query: jest.fn().mockImplementation((sql, params) => {
                if (sql && sql.includes('INSERT INTO party_rooms')) {
                    return Promise.resolve({
                        rows: [{ id: 'room-uuid', title: 'Test Room', host_id: 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b' }]
                    });
                }
                return Promise.resolve({ rows: [] });
            }),
            release: jest.fn()
        };
        db.pool.connect.mockResolvedValue(mockClient);

        // Smart mock implementation for db.query
        db.query.mockImplementation((sql, params) => {
            if (sql && sql.includes('FROM users WHERE id')) {
                return Promise.resolve({
                    rows: [{
                        id: 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b',
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
            if (sql && sql.includes('FROM party_rooms pr')) {
                return Promise.resolve({
                    rows: [{ id: 'room-1', title: 'Geyik Odası', host_id: 'user-1', active_speakers: 1, participants: [] }]
                });
            }
            if (sql && sql.includes('FROM party_room_seats prs')) {
                return Promise.resolve({
                    rows: [{ seat_number: 1, user_id: 'user-1', is_locked: false, is_muted: false }]
                });
            }
            return Promise.resolve({ rows: [] });
        });
    });

    describe('POST /api/party-rooms (Oda Oluşturma)', () => {
        it('should return 400 if title is missing', async () => {
            const res = await request(app)
                .post('/api/party-rooms')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({});
            
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Oda başlığı gereklidir.');
        });

        it('should successfully create a party room', async () => {
            const res = await request(app)
                .post('/api/party-rooms')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({ title: 'Test Room' });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('id', 'room-uuid');
            expect(res.body).toHaveProperty('title', 'Test Room');
        });
    });

    describe('GET /api/party-rooms (Oda Listeleme)', () => {
        it('should return active party rooms', async () => {
            const res = await request(app)
                .get('/api/party-rooms')
                .set('Authorization', `Bearer ${mockToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body[0]).toHaveProperty('title', 'Geyik Odası');
        });
    });

    describe('GET /api/party-rooms/:roomId/seats (Koltukları Getir)', () => {
        it('should return seats list for a room', async () => {
            const res = await request(app)
                .get('/api/party-rooms/room-1/seats')
                .set('Authorization', `Bearer ${mockToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body[0]).toHaveProperty('seat_number', 1);
        });
    });

    describe('GET /api/party-rooms/:roomId (Tek Oda Detayı)', () => {
        it('should return 404 if room does not exist', async () => {
            db.query
                .mockResolvedValueOnce({
                    rows: [{
                        id: 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b',
                        username: 'testuser',
                        email: 'test@example.com',
                        role: 'user',
                        account_status: 'active',
                        display_name: 'Test User',
                        avatar_url: 'https://via.placeholder.com/150',
                        gender: 'erkek',
                        onboarding_completed: true
                    }]
                })
                .mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .get('/api/party-rooms/non-existent-room')
                .set('Authorization', `Bearer ${mockToken}`);

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'Parti odası bulunamadı.');
        });

        it('should return room details if room exists', async () => {
            const res = await request(app)
                .get('/api/party-rooms/room-1')
                .set('Authorization', `Bearer ${mockToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('id', 'room-1');
            expect(res.body).toHaveProperty('title', 'Geyik Odası');
        });
    });
});
