// Mock db.query to avoid connecting to the database
jest.mock('../db', () => {
    const mockQuery = jest.fn().mockImplementation(() => Promise.resolve({ rows: [] }));
    return {
        query: mockQuery,
        pool: {
            connect: jest.fn().mockResolvedValue({
                query: jest.fn().mockResolvedValue({ rows: [] }),
                release: jest.fn()
            }),
            end: jest.fn().mockResolvedValue(true)
        }
    };
});

const db = require('../db');
const { handlePartyRoomSockets } = require('../socket/partyRoomSocket');

describe('Party Rooms Socket.io Event Tests', () => {
    let mockIo;
    let mockSocket;
    let registeredEvents;

    beforeEach(() => {
        jest.clearAllMocks();
        registeredEvents = {};

        // Mock io object
        mockIo = {
            to: jest.fn().mockImplementation(() => ({
                emit: jest.fn()
            }))
        };

        // Mock socket object
        mockSocket = {
            id: 'socket-id-123',
            user: { id: 'user-id-1', username: 'tester1', display_name: 'Tester One', vip_level: 2 },
            join: jest.fn(),
            leave: jest.fn(),
            emit: jest.fn(),
            on: jest.fn().mockImplementation((event, callback) => {
                registeredEvents[event] = callback;
            })
        };

        // Initialize listeners
        handlePartyRoomSockets(mockIo, mockSocket);
    });

    it('should register all required socket handlers', () => {
        expect(registeredEvents).toHaveProperty('join_party_room');
        expect(registeredEvents).toHaveProperty('leave_party_room');
        expect(registeredEvents).toHaveProperty('request_seat');
        expect(registeredEvents).toHaveProperty('leave_seat');
        expect(registeredEvents).toHaveProperty('toggle_seat_mute');
        expect(registeredEvents).toHaveProperty('lock_seat');
        expect(registeredEvents).toHaveProperty('send_party_message');
        expect(registeredEvents).toHaveProperty('send_party_gift');
        expect(registeredEvents).toHaveProperty('disconnect');
    });

    describe('join_party_room event', () => {
        it('should join the room, broadcast join to others and send current seats status', async () => {
            const seats = [{ seat_number: 1, user_id: null }];
            db.query.mockResolvedValueOnce({ rows: seats });

            await registeredEvents['join_party_room']({ roomId: 'room-1' });

            expect(mockSocket.join).toHaveBeenCalledWith('party_room_room-1');
            expect(mockIo.to).toHaveBeenCalledWith('party_room_room-1');
            expect(mockSocket.emit).toHaveBeenCalledWith('party_seats_state', seats);
        });
    });

    describe('request_seat event', () => {
        it('should allow user to sit if seat is unoccupied and unlocked', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ user_id: null, is_locked: false }] }) // checkRes
                .mockResolvedValueOnce({ rows: [] }) // Free old seats
                .mockResolvedValueOnce({ rows: [] }); // Update new seat

            await registeredEvents['request_seat']({ roomId: 'room-1', seatNumber: 1 });

            expect(mockIo.to).toHaveBeenCalledWith('party_room_room-1');
        });

        it('should return error if seat is locked', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ user_id: null, is_locked: true }] });

            await registeredEvents['request_seat']({ roomId: 'room-1', seatNumber: 1 });

            expect(mockSocket.emit).toHaveBeenCalledWith('party_room_error', { message: 'Bu koltuk şu an kilitli.' });
        });

        it('should return error if seat is occupied', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ user_id: 'user-2', is_locked: false }] });

            await registeredEvents['request_seat']({ roomId: 'room-1', seatNumber: 1 });

            expect(mockSocket.emit).toHaveBeenCalledWith('party_room_error', { message: 'Bu koltuk zaten dolu.' });
        });
    });

    describe('lock_seat event', () => {
        it('should block non-hosts from locking seats', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ host_id: 'owner-id-999' }] }); // Different host

            await registeredEvents['lock_seat']({ roomId: 'room-1', seatNumber: 1, isLocked: true });

            expect(mockSocket.emit).toHaveBeenCalledWith('party_room_error', { message: 'Sadece oda yöneticisi koltukları kilitleyebilir.' });
        });
    });

    describe('send_party_message event', () => {
        it('should broadcast text messages to the room', async () => {
            await registeredEvents['send_party_message']({ roomId: 'room-1', content: 'Merhaba Dünya!' });
            expect(mockIo.to).toHaveBeenCalledWith('party_room_room-1');
        });
    });

    describe('send_party_gift event', () => {
        it('should return error if balance is insufficient', async () => {
            const mockClient = {
                query: jest.fn()
                    .mockResolvedValueOnce({ rows: [] }) // BEGIN
                    .mockResolvedValueOnce({ rows: [{ id: 'gift-1', name: 'Rosy', cost: 100 }] }) // Gift fetch
                    .mockResolvedValueOnce({ rows: [{ balance: 50 }] }) // Sender balance (50 < 100)
                    .mockResolvedValueOnce({ rows: [] }), // ROLLBACK
                release: jest.fn()
            };
            db.pool.connect.mockResolvedValueOnce(mockClient);

            await registeredEvents['send_party_gift']({ roomId: 'room-1', targetUserId: 'recipient-1', giftId: 'gift-1' });

            expect(mockSocket.emit).toHaveBeenCalledWith('party_room_error', { message: 'Yetersiz bakiye. Bu hediye için 100 Coin gerekli.' });
        });

        it('should process gift correctly with sufficient balance and enforce idempotency key', async () => {
            const mockClient = {
                query: jest.fn()
                    .mockResolvedValueOnce({ rows: [] }) // BEGIN
                    .mockResolvedValueOnce({ rows: [{ id: 'gift-1', name: 'Rosy', cost: 100 }] }) // Gift details
                    .mockResolvedValueOnce({ rows: [{ balance: 200 }] }) // Sender balance (200 >= 100)
                    .mockResolvedValueOnce({ rows: [] }) // Update sender
                    .mockResolvedValueOnce({ rows: [] }) // Save txn log
                    .mockResolvedValueOnce({ rows: [{ gender: 'kadin', role: 'user' }] }) // Recipient details
                    .mockResolvedValueOnce({ rows: [] }) // Insert operators
                    .mockResolvedValueOnce({ rows: [] }) // Update operators balance
                    .mockResolvedValueOnce({ rows: [] }) // COMMIT
                    .mockResolvedValueOnce({ rows: [{ balance: 100 }] }), // Fetch new balance
                release: jest.fn()
            };
            db.pool.connect.mockResolvedValueOnce(mockClient);

            // First request should succeed
            await registeredEvents['send_party_gift']({ 
                roomId: 'room-1', 
                targetUserId: 'recipient-1', 
                giftId: 'gift-1',
                idempotencyKey: 'key-123'
            });

            expect(mockSocket.emit).toHaveBeenCalledWith('gift_success', { idempotencyKey: 'key-123', duplicate: false });

            // Second request with same key should skip database and return duplicate true
            await registeredEvents['send_party_gift']({ 
                roomId: 'room-1', 
                targetUserId: 'recipient-1', 
                giftId: 'gift-1',
                idempotencyKey: 'key-123'
            });

            expect(mockSocket.emit).toHaveBeenCalledWith('gift_success', { idempotencyKey: 'key-123', duplicate: true });
        });
    });
});
