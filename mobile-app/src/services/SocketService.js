import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_URL } from '../config';

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

class SocketService {
    constructor() {
        this._socket = null;
        this._reconnectAttempts = 0;
        this._currentRoomId = null;
        this._roomJoinedCallback = null;
        this._eventHandlers = new Map();
        this._isManualDisconnect = false;
    }

    // ─── Connection ───────────────────────────────────────────────────────────

    async connect() {
        if (this._socket?.connected) return this._socket;

        const token = await AsyncStorage.getItem('token');
        if (!token) {
            console.warn('[SocketService] No token found. Cannot connect.');
            return null;
        }

        this._isManualDisconnect = false;

        this._socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket'],
            reconnection: false, // We manage reconnect manually for better control
            timeout: 10000,
        });

        // Re-bind any existing handlers tracked in our Map to the new socket instance
        this._eventHandlers.forEach((handlers, event) => {
            handlers.forEach(h => this._socket.on(event, h));
        });

        this._socket.on('connect', () => {
            console.log('[SocketService] Connected:', this._socket.id);
            this._reconnectAttempts = 0;
            // Re-join room after reconnect
            if (this._currentRoomId) {
                this._joinRoom(this._currentRoomId);
            }
        });

        this._socket.on('disconnect', (reason) => {
            console.warn('[SocketService] Disconnected:', reason);
            if (!this._isManualDisconnect) {
                this._scheduleReconnect();
            }
        });

        this._socket.on('connect_error', (err) => {
            console.error('[SocketService] Connection error:', err.message);
            if (!this._isManualDisconnect) {
                this._scheduleReconnect();
            }
        });

        return this._socket;
    }

    disconnect() {
        this._isManualDisconnect = true;
        this._currentRoomId = null;
        if (this._socket) {
            this._socket.removeAllListeners();
            this._socket.disconnect();
            this._socket = null;
        }
    }

    _scheduleReconnect() {
        if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error('[SocketService] Max reconnect attempts reached.');
            return;
        }
        this._reconnectAttempts++;
        console.log(`[SocketService] Reconnecting... attempt ${this._reconnectAttempts}`);
        setTimeout(async () => {
            await this.connect();
        }, RECONNECT_DELAY_MS);
    }

    // ─── Room Management ──────────────────────────────────────────────────────

    joinRoom(roomId, callback) {
        this._currentRoomId = roomId;
        this._roomJoinedCallback = callback;
        this._joinRoom(roomId);
    }

    _joinRoom(roomId) {
        if (!this._socket?.connected) return;
        this._socket.emit('join_party_room', { roomId }, (response) => {
            if (this._roomJoinedCallback) {
                this._roomJoinedCallback(response);
            }
        });
    }

    leaveRoom(roomId) {
        console.log('[SocketService] leaveRoom called for roomId:', roomId);
        this._currentRoomId = null;
        this._roomJoinedCallback = null;
        if (this._socket?.connected) {
            console.log('[SocketService] Emitting leave_party_room for roomId:', roomId);
            this._socket.emit('leave_party_room', { roomId });
        }
    }

    // ─── Event Subscription ───────────────────────────────────────────────────

    on(event, handler) {
        if (!this._socket) return;
        this._socket.on(event, handler);
        // Track for cleanup
        const existing = this._eventHandlers.get(event) || [];
        this._eventHandlers.set(event, [...existing, handler]);
    }

    off(event, handler) {
        if (handler) {
            if (this._socket) this._socket.off(event, handler);
            const existing = this._eventHandlers.get(event) || [];
            this._eventHandlers.set(event, existing.filter(h => h !== handler));
        } else {
            if (this._socket) this._socket.removeAllListeners(event);
            this._eventHandlers.delete(event);
        }
    }

    offAll() {
        if (!this._socket) return;
        this._eventHandlers.forEach((handlers, event) => {
            handlers.forEach(h => this._socket.off(event, h));
        });
        this._eventHandlers.clear();
    }

    // ─── Emit Helpers ─────────────────────────────────────────────────────────

    emit(event, data) {
        if (!this._socket) {
            console.warn(`[SocketService] emit '${event}' failed: socket not initialized.`);
            return;
        }
        this._socket.emit(event, data);
    }

    // ─── Room-specific emits ──────────────────────────────────────────────────

    sendMessage(roomId, content, clientMessageId) {
        this.emit('send_party_message', { roomId, content, clientMessageId });
    }

    sendReaction(roomId, emoji) {
        this.emit('send_party_reaction', { roomId, emoji });
    }

    sendGift(roomId, receiverUserId, giftId, quantity, idempotencyKey) {
        this.emit('send_party_gift', { roomId, receiverUserId, giftId, quantity, idempotencyKey });
    }

    takeSeat(roomId, seatNumber) {
        this.emit('request_seat', { roomId, seatNumber });
    }

    leaveSeat(roomId, seatNumber) {
        this.emit('leave_seat', { roomId, seatNumber });
    }

    toggleSeatMute(roomId, seatNumber, isMuted) {
        this.emit('toggle_seat_mute', { roomId, seatNumber, isMuted });
    }

    lockSeat(roomId, seatNumber, isLocked) {
        this.emit('lock_seat', { roomId, seatNumber, isLocked });
    }

    // ─── Getters ──────────────────────────────────────────────────────────────

    get socket() {
        return this._socket;
    }

    get isConnected() {
        return this._socket?.connected ?? false;
    }
}

// Singleton export
export default new SocketService();
