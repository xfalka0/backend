import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';
import SocketService from '../services/SocketService';

const MAX_CHAT_MESSAGES = 100;
const GIFT_BANNER_DURATION_MS = 4000;

export const useRoomStore = create((set, get) => ({
    // ─── State ────────────────────────────────────────────────────────────────
    room: null,
    members: [],
    seats: [],
    onlineCount: 0,
    messages: [],
    isLoading: false,
    error: null,

    // Gift banner queue
    giftBannerQueue: [],
    currentGiftBanner: null,
    giftBannerTimer: null,

    // Mic/speaker local state for current user
    isMicEnabled: false,
    isSpeakerEnabled: true,

    // Moderasyon events
    lastModerationEvent: null,

    // ─── Room Join / Leave ────────────────────────────────────────────────────

    joinRoom: async (roomId) => {
        set({ isLoading: true, error: null });
        try {
            const token = await AsyncStorage.getItem('token');
            // 1. Load room detail from REST
            const [roomRes, seatsRes] = await Promise.all([
                axios.get(`${API_URL}/party-rooms/${roomId}`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_URL}/party-rooms/${roomId}/seats`, { headers: { Authorization: `Bearer ${token}` } }),
            ]);

            set({
                room: roomRes.data,
                seats: seatsRes.data || [],
                messages: [],
                isLoading: false,
            });

            // 2. Connect socket and join room
            await SocketService.connect();
            get()._subscribeToRoom(roomId);
            SocketService.joinRoom(roomId, (roomData) => {
                if (roomData) {
                    set({
                        onlineCount: roomData.onlineCount || 0,
                        seats: roomData.seats || get().seats,
                        messages: roomData.recentMessages || [],
                    });
                }
            });
        } catch (err) {
            console.error('[RoomStore] joinRoom error:', err.message);
            set({ isLoading: false, error: err.message });
        }
    },

    leaveRoom: () => {
        const { room } = get();
        if (room) {
            SocketService.leaveRoom(room.id);
        }
        get()._unsubscribeFromRoom();
        set({
            room: null, members: [], seats: [], onlineCount: 0,
            messages: [], giftBannerQueue: [], currentGiftBanner: null,
            isMicEnabled: false, lastModerationEvent: null,
        });
    },

    // ─── Seat Actions ─────────────────────────────────────────────────────────

    takeSeat: (seatNumber) => {
        const { room } = get();
        if (!room) return;
        SocketService.takeSeat(room.id, seatNumber);
    },

    leaveSeat: (seatNumber) => {
        const { room } = get();
        if (!room) return;
        SocketService.leaveSeat(room.id, seatNumber);
        set({ isMicEnabled: false });
    },

    toggleSeatMute: (seatNumber) => {
        const { room } = get();
        if (!room) return;
        SocketService.toggleSeatMute(room.id, seatNumber);
    },

    lockSeat: (seatNumber, isLocked) => {
        const { room } = get();
        if (!room) return;
        SocketService.lockSeat(room.id, seatNumber, isLocked);
    },

    toggleMic: () => {
        set(s => ({ isMicEnabled: !s.isMicEnabled }));
    },

    toggleSpeaker: () => {
        set(s => ({ isSpeakerEnabled: !s.isSpeakerEnabled }));
    },

    // ─── Chat ─────────────────────────────────────────────────────────────────

    sendMessage: (content) => {
        const { room } = get();
        if (!room || !content.trim()) return;
        const clientMessageId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        SocketService.sendMessage(room.id, content.trim(), clientMessageId);
    },

    addMessage: (msg) => {
        set(s => {
            const messages = [...s.messages, msg];
            if (messages.length > MAX_CHAT_MESSAGES) messages.splice(0, messages.length - MAX_CHAT_MESSAGES);
            return { messages };
        });
    },

    addSystemMessage: (text, type = 'system') => {
        get().addMessage({
            id: `sys_${Date.now()}_${Math.random()}`,
            isSystem: true,
            messageType: type,
            content: text,
            createdAt: new Date().toISOString(),
        });
    },

    clearMessages: () => set({ messages: [] }),

    // ─── Gift Banner ──────────────────────────────────────────────────────────

    pushGiftBanner: (giftEvent) => {
        const { giftBannerQueue, currentGiftBanner, _advanceBannerQueue } = get();
        if (!currentGiftBanner) {
            set({ currentGiftBanner: giftEvent });
            const timer = setTimeout(() => get()._advanceBannerQueue(), GIFT_BANNER_DURATION_MS);
            set({ giftBannerTimer: timer });
        } else {
            set({ giftBannerQueue: [...giftBannerQueue, giftEvent] });
        }
    },

    _advanceBannerQueue: () => {
        const { giftBannerQueue } = get();
        if (giftBannerQueue.length === 0) {
            set({ currentGiftBanner: null, giftBannerTimer: null });
            return;
        }
        const [next, ...rest] = giftBannerQueue;
        set({ currentGiftBanner: next, giftBannerQueue: rest });
        const timer = setTimeout(() => get()._advanceBannerQueue(), GIFT_BANNER_DURATION_MS);
        set({ giftBannerTimer: timer });
    },

    // ─── Socket Subscriptions ─────────────────────────────────────────────────

    _subscribeToRoom: (roomId) => {
        const store = get();

        SocketService.on('party_seats_state', (seatsState) => {
            set({ seats: seatsState });
        });

        SocketService.on('party_seat_updated', (updatedSeat) => {
            set(s => ({
                seats: s.seats.map(seat =>
                    seat.seat_number === updatedSeat.seat_number ? { ...seat, ...updatedSeat } : seat
                )
            }));
            if (updatedSeat.user_id) {
                store.addSystemMessage(`${updatedSeat.display_name || updatedSeat.username} koltuğa oturdu.`);
            } else {
                store.addSystemMessage(`Bir kullanıcı koltuğu boşalttı.`);
            }
        });

        SocketService.on('party_seat_mute_changed', (data) => {
            set(s => ({
                seats: s.seats.map(seat =>
                    seat.seat_number === data.seat_number ? { ...seat, is_muted: data.is_muted } : seat
                )
            }));
        });

        SocketService.on('party_seat_lock_changed', (data) => {
            set(s => ({
                seats: s.seats.map(seat =>
                    seat.seat_number === data.seat_number
                        ? { ...seat, is_locked: data.is_locked, user_id: data.is_locked ? null : seat.user_id }
                        : seat
                )
            }));
        });

        SocketService.on('receive_party_message', (msg) => {
            store.addMessage(msg);
        });

        SocketService.on('user_joined_party', (data) => {
            set(s => ({ onlineCount: s.onlineCount + 1 }));
            store.addSystemMessage(`${data.display_name || data.username} odaya girdi.`);
        });

        SocketService.on('user_left_party', (data) => {
            set(s => ({ onlineCount: Math.max(0, s.onlineCount - 1) }));
        });

        SocketService.on('party_gift_sent', (giftData) => {
            store.pushGiftBanner(giftData);
            const icon = giftData.giftIcon || '🎁';
            store.addSystemMessage(
                `${giftData.sender?.display_name || giftData.sender?.username} → ${giftData.receiver?.display_name || giftData.receiver?.username}: ${icon} ${giftData.giftName || 'Hediye'} gönderdi!`,
                'gift'
            );
        });

        SocketService.on('party_chat_cleared', () => {
            store.clearMessages();
            store.addSystemMessage('Oda sohbeti temizlendi.');
        });

        SocketService.on('moderation:kicked', (data) => {
            set({ lastModerationEvent: { type: 'kicked', ...data } });
        });

        SocketService.on('moderation:muted', (data) => {
            set({ lastModerationEvent: { type: 'muted', ...data } });
        });

        SocketService.on('moderation:chat_banned', (data) => {
            set({ lastModerationEvent: { type: 'chat_banned', ...data } });
        });

        SocketService.on('party_room_closed', () => {
            set({ lastModerationEvent: { type: 'room_closed' } });
        });

        SocketService.on('party_room_error', (err) => {
            console.error('[RoomStore] Socket error:', err);
        });
    },

    _unsubscribeFromRoom: () => {
        SocketService.offAll();
    },
}));
