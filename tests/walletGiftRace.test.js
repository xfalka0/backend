// Mock db.query to avoid connecting to the database
jest.mock('../db', () => {
    const mockQuery = jest.fn().mockImplementation((sql, params) => {
        if (sql && sql.includes('FROM users WHERE id')) {
            return Promise.resolve({
                rows: [{
                    id: 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b',
                    username: 'testuser',
                    role: 'user',
                    account_status: 'active'
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

const db = require('../db');
const { handlePartyRoomSockets } = require('../socket/partyRoomSocket');

describe('Wallet and Gift Race Condition Tests', () => {
    let mockIo;
    let mockSocket;
    let registeredEvents;

    beforeEach(() => {
        jest.clearAllMocks();
        registeredEvents = {};

        mockIo = {
            to: jest.fn().mockImplementation(() => ({
                emit: jest.fn()
            }))
        };

        mockSocket = {
            id: 'socket-id-123',
            user: { id: 'user-id-1', username: 'tester1', display_name: 'Tester One', vip_level: 1 },
            emit: jest.fn(),
            on: jest.fn().mockImplementation((event, callback) => {
                registeredEvents[event] = callback;
            })
        };

        handlePartyRoomSockets(mockIo, mockSocket);
    });

    describe('Concurrent Gift Sending (Race Condition)', () => {
        it('should process only one transaction when 10 identical gifts with the SAME idempotencyKey are sent concurrently', async () => {
            const mockClient = {
                query: jest.fn()
                    .mockResolvedValueOnce({ rows: [] }) // BEGIN
                    .mockResolvedValueOnce({ rows: [{ id: 'gift-1', name: 'Rosy', cost: 50 }] }) // Gift fetch
                    .mockResolvedValueOnce({ rows: [{ balance: 200 }] }) // Balance (200)
                    .mockResolvedValueOnce({ rows: [] }) // Update user balance
                    .mockResolvedValueOnce({ rows: [] }) // Insert transactions
                    .mockResolvedValueOnce({ rows: [] }) // Recipient check
                    .mockResolvedValueOnce({ rows: [] }) // COMMIT
                    .mockResolvedValueOnce({ rows: [{ balance: 150 }] }), // Fetch new balance
                release: jest.fn()
            };
            db.pool.connect.mockResolvedValue(mockClient);

            const requests = [];
            const data = { 
                roomId: 'room-1', 
                targetUserId: 'recipient-1', 
                giftId: 'gift-1', 
                idempotencyKey: 'same-idempotency-key-999' 
            };

            // Send 10 concurrent requests
            for (let i = 0; i < 10; i++) {
                requests.push(registeredEvents['send_party_gift'](data));
            }

            await Promise.all(requests);

            // Verify that only the first request actually ran queries through the database client
            // The duplicate checks in memory prevent subsequent queries from executing
            expect(mockClient.query).toHaveBeenCalledTimes(8); // BEGIN, select gift, select user balance, update balance, insert txn, select recipient, COMMIT, select balance
            expect(mockSocket.emit).toHaveBeenCalledWith('gift_success', { idempotencyKey: 'same-idempotency-key-999', duplicate: false });
            expect(mockSocket.emit).toHaveBeenCalledWith('gift_success', { idempotencyKey: 'same-idempotency-key-999', duplicate: true });
        });

        it('should prevent negative balances and process only affordable gifts when multiple requests with DIFFERENT idempotencyKeys are sent', async () => {
            let currentBalance = 75; // Only enough for ONE gift costing 50
            const giftCost = 50;

            // Mock DB client behavior for transaction
            const mockClient = {
                query: jest.fn().mockImplementation((sql, params) => {
                    if (sql.includes('BEGIN')) return Promise.resolve({ rows: [] });
                    if (sql.includes('SELECT * FROM gifts')) {
                        return Promise.resolve({ rows: [{ id: 'gift-1', name: 'Rosy', cost: giftCost }] });
                    }
                    if (sql.includes('SELECT balance FROM users')) {
                        return Promise.resolve({ rows: [{ balance: currentBalance }] });
                    }
                    if (sql.includes('UPDATE users SET balance')) {
                        currentBalance -= giftCost; // Deduct balance
                        return Promise.resolve({ rows: [] });
                    }
                    if (sql.includes('COMMIT')) return Promise.resolve({ rows: [] });
                    if (sql.includes('ROLLBACK')) return Promise.resolve({ rows: [] });
                    return Promise.resolve({ rows: [] });
                }),
                release: jest.fn()
            };
            db.pool.connect.mockResolvedValue(mockClient);

            // Execute two requests with different keys sequentially to check logic
            await registeredEvents['send_party_gift']({ 
                roomId: 'room-1', targetUserId: 'recipient-1', giftId: 'gift-1', idempotencyKey: 'key-diff-1' 
            });
            await registeredEvents['send_party_gift']({ 
                roomId: 'room-1', targetUserId: 'recipient-1', giftId: 'gift-1', idempotencyKey: 'key-diff-2' 
            });

            // The first request had 75 balance (75 >= 50) -> succeeded, balance drops to 25.
            // The second request had 25 balance (25 < 50) -> failed with error, rolled back.
            expect(currentBalance).toBe(25); 
            expect(mockSocket.emit).toHaveBeenCalledWith('party_room_error', { message: 'Yetersiz bakiye. Bu hediye için 50 Coin gerekli.' });
        });
    });
});
