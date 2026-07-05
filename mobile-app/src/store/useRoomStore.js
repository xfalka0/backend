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
    bannedMembers: [],
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

    // ─── API Moderation Actions ────────────────────────────────────────────────

    fetchMembers: async (roomId, query = '') => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/party-rooms/${roomId}/members?query=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ members: res.data || [] });
            return res.data;
        } catch (err) {
            console.error('[RoomStore] fetchMembers error:', err.message);
            return [];
        }
    },

    fetchBannedMembers: async (roomId) => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/party-rooms/${roomId}/banned`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            set({ bannedMembers: res.data || [] });
            return res.data;
        } catch (err) {
            console.error('[RoomStore] fetchBannedMembers error:', err.message);
            return [];
        }
    },

    promoteToRoomAdmin: async (roomId, targetUserId) => {
        const token = await AsyncStorage.getItem('token');
        await axios.post(`${API_URL}/party-rooms/${roomId}/assign-role`, { targetUserId, role: 'room_admin' }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        await get().fetchMembers(roomId);
    },

    demoteRoomAdmin: async (roomId, targetUserId) => {
        const token = await AsyncStorage.getItem('token');
        await axios.post(`${API_URL}/party-rooms/${roomId}/assign-role`, { targetUserId, role: 'listener' }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        await get().fetchMembers(roomId);
    },

    promoteToModerator: async (roomId, targetUserId) => {
        const token = await AsyncStorage.getItem('token');
        await axios.post(`${API_URL}/party-rooms/${roomId}/assign-role`, { targetUserId, role: 'room_moderator' }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        await get().fetchMembers(roomId);
    },

    demoteModerator: async (roomId, targetUserId) => {
        const token = await AsyncStorage.getItem('token');
        await axios.post(`${API_URL}/party-rooms/${roomId}/assign-role`, { targetUserId, role: 'listener' }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        await get().fetchMembers(roomId);
    },

    muteMember: async (roomId, targetUserId, isMuted) => {
        const token = await AsyncStorage.getItem('token');
        await axios.post(`${API_URL}/party-rooms/${roomId}/mute`, { targetUserId, isMuted }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        await get().fetchMembers(roomId);
    },

    kickMember: async (roomId, targetUserId) => {
        const token = await AsyncStorage.getItem('token');
        await axios.post(`${API_URL}/party-rooms/${roomId}/kick`, { targetUserId }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        await get().fetchMembers(roomId);
    },

    banMember: async (roomId, targetUserId, reason = '') => {
        const token = await AsyncStorage.getItem('token');
        await axios.post(`${API_URL}/party-rooms/${roomId}/ban`, { targetUserId, reason }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        await get().fetchMembers(roomId);
        await get().fetchBannedMembers(roomId);
    },

    unbanMember: async (roomId, targetUserId) => {
        const token = await AsyncStorage.getItem('token');
        await axios.post(`${API_URL}/party-rooms/${roomId}/unban`, { targetUserId }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        await get().fetchBannedMembers(roomId);
    },

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

            // Fetch initial members list for listener bubbles
            get().fetchMembers(roomId).catch(() => {});

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
            const giftId = Number(giftEvent?.gift_id);
            const duration = giftId === 6 ? 6000 : (giftId === 7 ? 5000 : GIFT_BANNER_DURATION_MS);
            const timer = setTimeout(() => get()._advanceBannerQueue(), duration);
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
        const giftId = Number(next?.gift_id);
        const duration = giftId === 6 ? 6000 : (giftId === 7 ? 5000 : GIFT_BANNER_DURATION_MS);
        const timer = setTimeout(() => get()._advanceBannerQueue(), duration);
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

        SocketService.on('receive_party_reaction', (data) => {
            console.log('[CLIENT STORE] receive_party_reaction received:', data);
            const { userId, emoji } = data;
            set(s => ({
                seats: s.seats.map(seat => {
                    console.log(`[CLIENT STORE] Checking seat ${seat.seat_number}: seat.user_id=${seat.user_id} (${typeof seat.user_id}), target userId=${userId} (${typeof userId})`);
                    if (seat.user_id?.toString() === userId?.toString()) {
                        console.log(`[CLIENT STORE] Seat matches! Setting reaction ${emoji} on seat ${seat.seat_number}`);
                        return { 
                            ...seat, 
                            activeReaction: { 
                                emoji, 
                                id: Date.now() + Math.random()
                            } 
                        };
                    }
                    return seat;
                })
            }));
            
            // Clear the reaction after 2.5 seconds
            setTimeout(() => {
                set(s => ({
                    seats: s.seats.map(seat => {
                        if (seat.user_id?.toString() === userId?.toString()) {
                            return { ...seat, activeReaction: null };
                        }
                        return seat;
                    })
                }));
            }, 2500);
        });

        SocketService.on('user_left_party', (data) => {
            set(s => ({ onlineCount: Math.max(0, s.onlineCount - 1) }));
            const currentRoom = store.room;
            if (currentRoom) {
                store.fetchMembers(currentRoom.id);
            }
        });

        SocketService.on('user_joined_party', (data) => {
            set(s => ({ onlineCount: s.onlineCount + 1 }));
            store.addSystemMessage(`${data.display_name || data.username} odaya girdi.`);
            const currentRoom = store.room;
            if (currentRoom) {
                store.fetchMembers(currentRoom.id);
            }
        });

        SocketService.on('party_member_updated', (data) => {
            const currentRoom = store.room;
            if (currentRoom) {
                store.fetchMembers(currentRoom.id);
            }
        });

        SocketService.on('party_gift_sent', (giftData) => {
            store.pushGiftBanner(giftData);
            const icon = giftData.giftIcon || '🎁';
            store.addSystemMessage(
                `${giftData.sender?.display_name || giftData.sender?.username} → ${giftData.receiver?.display_name || giftData.receiver?.username}: ${icon} ${giftData.giftName || 'Hediye'} gönderdi!`,
                'gift'
            );
        });

        SocketService.on('room:gift_received', (data) => {
            set(s => ({
                seats: s.seats.map(seat => 
                    seat.user_id?.toString() === data.receiverId?.toString()
                        ? { ...seat, room_gift_points: data.receiverRoomGiftPoints }
                        : seat
                ),
                members: s.members.map(member => 
                    member.user_id?.toString() === data.receiverId?.toString()
                        ? { ...member, room_gift_points: data.receiverRoomGiftPoints }
                        : member
                )
            }));
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
