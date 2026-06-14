import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';

// Default gift catalog — can be replaced with server data
export const DEFAULT_GIFTS = [
    { id: 1,  name: 'Gül',         cost: 50,    icon: '🌹', category: 'basic' },
    { id: 2,  name: 'Kahve',       cost: 100,   icon: '☕', category: 'basic' },
    { id: 3,  name: 'Çikolata',    cost: 250,   icon: '🍫', category: 'basic' },
    { id: 4,  name: 'Ayıcık',      cost: 500,   icon: '🧸', category: 'special' },
    { id: 5,  name: 'Pırlanta',    cost: 1000,  icon: '💎', category: 'special' },
    { id: 6,  name: 'Yarış Arabası', cost: 2000, icon: '🏎️', category: 'premium' },
    { id: 7,  name: 'Şato',        cost: 5000,  icon: '🏰', category: 'premium' },
    { id: 8,  name: 'Roket',       cost: 8000,  icon: '🚀', category: 'premium' },
    { id: 9,  name: 'Yelken',      cost: 12000, icon: '⛵', category: 'premium' },
    { id: 10, name: 'Taç',         cost: 20000, icon: '👑', category: 'luxury'  },
    { id: 11, name: 'Galaxy',      cost: 50000, icon: '🌌', category: 'luxury'  },
    { id: 12, name: 'Unicorn',     cost: 100000,icon: '🦄', category: 'luxury'  },
];

export const useGiftStore = create((set, get) => ({
    // ─── State ────────────────────────────────────────────────────────────────
    gifts: DEFAULT_GIFTS,
    serverGiftsLoaded: false,
    isVisible: false,
    targetSeat: null, // Seat object gift is being sent to
    isSending: false,
    lastSentGift: null,
    selectedCategory: 'all',

    // ─── Actions ──────────────────────────────────────────────────────────────

    openGiftPicker: (seat = null) => {
        set({ isVisible: true, targetSeat: seat, selectedCategory: 'all' });
    },

    closeGiftPicker: () => {
        set({ isVisible: false, targetSeat: null, isSending: false });
    },

    setCategory: (category) => set({ selectedCategory: category }),

    loadGiftsFromServer: async () => {
        if (get().serverGiftsLoaded) return;
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/gifts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                set({ gifts: res.data, serverGiftsLoaded: true });
            }
        } catch (err) {
            // fallback to defaults — already set
            console.log('[GiftStore] Using default gift catalog:', err.message);
        }
    },

    sendGift: async (gift, balance, setBalance, socketService, room) => {
        const { targetSeat, isSending } = get();
        if (isSending || !room) return { success: false, error: 'Busy' };

        if (balance < gift.cost) {
            return { success: false, error: 'insufficient_balance' };
        }

        set({ isSending: true });

        const idempotencyKey = `${Date.now()}_${gift.id}_${Math.random().toString(36).slice(2)}`;

        socketService.sendGift(
            room.id,
            targetSeat?.user_id || null,
            gift.id,
            1,
            idempotencyKey
        );

        // Optimistic balance decrement
        setBalance(Math.max(0, balance - gift.cost));
        set({ isSending: false, lastSentGift: gift, isVisible: false, targetSeat: null });

        return { success: true };
    },

    filteredGifts: () => {
        const { gifts, selectedCategory } = get();
        if (selectedCategory === 'all') return gifts;
        return gifts.filter(g => g.category === selectedCategory);
    },
}));
