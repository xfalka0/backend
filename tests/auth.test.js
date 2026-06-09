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

describe('Authentication API Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Explicitly set the default mock implementation to prevent resetMocks from clearing it
        db.query.mockImplementation(() => Promise.resolve({ rows: [] }));
    });

    describe('POST /api/auth/request-otp', () => {
        it('should return 400 if email is missing', async () => {
            const res = await request(app)
                .post('/api/auth/request-otp')
                .send({});
            
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        it('should successfully request an OTP', async () => {
            db.query.mockResolvedValueOnce({ rows: [] }); // User lookup mock (not found -> register)
            db.query.mockResolvedValueOnce({ rows: [] }); // Insert OTP mock
            
            const res = await request(app)
                .post('/api/auth/request-otp')
                .send({ email: 'test@example.com' });
            
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message');
            expect(res.body.message).toContain('OTP gönderildi.');
        });
    });

    describe('POST /api/auth/verify-otp', () => {
        it('should return 401 if params are missing', async () => {
            db.query.mockResolvedValueOnce({ rows: [] }); // No matching OTP found
            
            const res = await request(app)
                .post('/api/auth/verify-otp')
                .send({});
            
            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toContain('Geçersiz veya süresi dolmuş kod');
        });

        it('should return 401 for invalid/expired OTP', async () => {
            db.query.mockResolvedValueOnce({ rows: [] }); // No matching OTP found
            
            const res = await request(app)
                .post('/api/auth/verify-otp')
                .send({ email: 'wrong@example.com', otp: '999999' });
            
            expect(res.status).toBe(401);
            expect(res.body.error).toContain('Geçersiz veya süresi dolmuş kod');
        });
    });
});
