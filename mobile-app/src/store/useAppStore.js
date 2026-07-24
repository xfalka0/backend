import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Device from 'expo-device';
import { API_URL } from '../config';

export const useAppStore = create((set, get) => ({
    user: null,
    role: null, // 'customer' | 'operator'
    balance: 0,
    unreadCount: 0,
    activeCallChatId: null,
    performanceMode: 'balanced', // 'low' | 'balanced' | 'high'

    setActiveCallChatId: (chatId) => set({ activeCallChatId: chatId }),
    
    setPerformanceMode: (mode) => {
        set({ performanceMode: mode });
        AsyncStorage.setItem('performance_mode', mode).catch(err => {
            console.error('[useAppStore] Error writing performance mode:', err);
        });
    },

    initializePerformanceMode: async () => {
        try {
            const stored = await AsyncStorage.getItem('performance_mode');
            if (stored) {
                set({ performanceMode: stored });
                return;
            }
            // Auto detect based on RAM total memory
            const ramBytes = Device.totalMemory;
            let mode = 'balanced';
            if (ramBytes && ramBytes < 4.5 * 1024 * 1024 * 1024) {
                mode = 'low';
            } else if (ramBytes && ramBytes > 6.5 * 1024 * 1024 * 1024) {
                mode = 'high';
            }
            set({ performanceMode: mode });
            await AsyncStorage.setItem('performance_mode', mode);
        } catch (e) {
            console.warn('[useAppStore] Performance detection error:', e);
        }
    },

    setUser: (user) => {
        if (!user) {
            set({ user: null, role: null, balance: 0 });
            return;
        }
        
        // Derive role: If gender === 'kadin' or role is operator/staff, they are an operator, unless they are male
        const isMale = (user.gender || '').toLowerCase() === 'erkek';
        const isOperator = !isMale && (
            (user.gender || '').toLowerCase() === 'kadin' || 
            ['operator', 'staff', 'moderator', 'admin', 'super_admin'].includes(user.role)
        );
        const role = isOperator ? 'operator' : 'customer';
        
        // Balance: operators use pending_balance/diamonds, customers use coins/balance
        const balance = isOperator 
            ? parseFloat(user.pending_balance || 0) 
            : parseFloat(user.balance !== undefined ? user.balance : (user.coins || 0));

        set({ user, role, balance });
        
        // Persist to storage just in case
        AsyncStorage.setItem('user', JSON.stringify(user)).catch(err => {
            console.error('[Zustand] Storage write error:', err);
        });
    },

    setBalance: (balance) => {
        set({ balance: parseFloat(balance) });
    },

    setUnreadCount: (count) => {
        set({ unreadCount: count });
    },

    syncBalanceWithServer: async () => {
        const { user, role } = get();
        if (!user) return;

        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            if (role === 'operator') {
                const res = await axios.get(`${API_URL}/operators/my/stats`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data) {
                    const pending = parseFloat(res.data.pending_balance || 0);
                    set({ balance: pending });
                }
            } else {
                const res = await axios.get(`${API_URL}/users/${user.id}/balance`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data) {
                    set({ balance: parseFloat(res.data.balance || 0) });
                }
            }
        } catch (error) {
            console.error('[Zustand] Sync balance error:', error);
        }
    },

    logout: async () => {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        set({ user: null, role: null, balance: 0, unreadCount: 0 });
    }
}));
