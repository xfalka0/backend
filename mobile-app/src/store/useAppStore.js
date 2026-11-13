import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Device from 'expo-device';
import { API_URL } from '../config';

const PERF_MODE_KEY = 'performance_mode';
const PERF_OVERRIDE_KEY = 'performance_mode_user_override';
const VALID_PERF_MODES = new Set(['low', 'balanced', 'high']);

const detectInitialPerformanceMode = () => {
    try {
        const ramBytes = Device.totalMemory;
        if (ramBytes && ramBytes < 4.5 * 1024 * 1024 * 1024) return 'low';
        if (ramBytes && ramBytes > 6.5 * 1024 * 1024 * 1024) return 'high';
    } catch (e) {}
    return 'balanced';
};

// Shared in-flight & short-TTL balance deduplicator to avoid duplicate boot requests
const BALANCE_DEDUPE_TTL_MS = 4000;
let inFlightBalancePromise = null;
let inFlightBalanceUserId = null;

export const useAppStore = create((set, get) => ({
    user: null,
    role: null, // 'customer' | 'operator'
    balance: 0,
    lastBalanceSyncAt: 0,
    unreadCount: 0,
    activeCallChatId: null,
    performanceMode: detectInitialPerformanceMode(), // 'low' | 'balanced' | 'high'
    performanceModeUserOverride: false,
    sessionStatus: 'pending', // 'pending' | 'verified' | 'unauthenticated'
    serverUserSynced: false,
    lastAuthMeAt: 0,
    bootAuthMeInFlight: false,

    setSessionStatus: (sessionStatus) => set({ sessionStatus }),
    setBootAuthMeInFlight: (inFlight) => set({ bootAuthMeInFlight: !!inFlight }),
    setServerAuthSync: (synced) => set({
        serverUserSynced: !!synced,
        lastAuthMeAt: synced ? Date.now() : 0,
    }),

    setActiveCallChatId: (chatId) => set({ activeCallChatId: chatId }),
    
    setPerformanceMode: (mode, isUserOverride = true) => {
        if (!isUserOverride || mode === 'auto' || !VALID_PERF_MODES.has(mode)) {
            const detected = detectInitialPerformanceMode();
            set({ performanceMode: detected, performanceModeUserOverride: false });
            AsyncStorage.multiSet([
                [PERF_MODE_KEY, detected],
                [PERF_OVERRIDE_KEY, 'false'],
            ]).catch(err => {
                console.error('[useAppStore] Error resetting performance mode:', err);
            });
            return;
        }
        set({ performanceMode: mode, performanceModeUserOverride: true });
        AsyncStorage.multiSet([
            [PERF_MODE_KEY, mode],
            [PERF_OVERRIDE_KEY, 'true'],
        ]).catch(err => {
            console.error('[useAppStore] Error writing performance mode:', err);
        });
    },

    initializePerformanceMode: async () => {
        try {
            const entries = await AsyncStorage.multiGet([PERF_MODE_KEY, PERF_OVERRIDE_KEY]);
            const stored = entries[0]?.[1];
            const hasUserOverride = entries[1]?.[1] === 'true';

            // Honor stored mode only if user explicitly chose it; migrate legacy values by re-detecting RAM
            if (hasUserOverride && VALID_PERF_MODES.has(stored)) {
                set({ performanceMode: stored, performanceModeUserOverride: true });
                return;
            }
            const mode = detectInitialPerformanceMode();
            set({ performanceMode: mode, performanceModeUserOverride: false });
            await AsyncStorage.multiSet([
                [PERF_MODE_KEY, mode],
                [PERF_OVERRIDE_KEY, 'false'],
            ]);
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

    setBalance: (balance, markSynced = false) => {
        const nextVal = parseFloat(balance || 0);
        set(markSynced ? { balance: nextVal, lastBalanceSyncAt: Date.now() } : { balance: nextVal });
    },

    setUnreadCount: (count) => {
        set({ unreadCount: count });
    },

    syncBalanceWithServer: async (options = {}) => {
        const force = typeof options === 'boolean' ? options : !!options?.force;
        const { user, role, lastBalanceSyncAt, balance } = get();
        if (!user?.id) return balance;

        if (!force && inFlightBalancePromise && inFlightBalanceUserId === user.id) {
            return inFlightBalancePromise;
        }
        if (!force && lastBalanceSyncAt > 0 && (Date.now() - lastBalanceSyncAt) < BALANCE_DEDUPE_TTL_MS) {
            return balance;
        }

        const runSync = (async () => {
            try {
                const token = await AsyncStorage.getItem('token');
                if (!token) return get().balance;

                if (role === 'operator') {
                    const res = await axios.get(`${API_URL}/operators/my/stats`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.data) {
                        const pending = parseFloat(res.data.pending_balance || 0);
                        set({ balance: pending, lastBalanceSyncAt: Date.now() });
                        return pending;
                    }
                } else {
                    const res = await axios.get(`${API_URL}/users/${user.id}/balance`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.data && res.data.balance !== undefined) {
                        const freshBal = parseFloat(res.data.balance || 0);
                        set({ balance: freshBal, lastBalanceSyncAt: Date.now() });
                        return freshBal;
                    }
                }
            } catch (error) {
                console.error('[Zustand] Sync balance error:', error);
            }
            return get().balance;
        })();

        inFlightBalanceUserId = user.id;
        inFlightBalancePromise = runSync.finally(() => {
            if (inFlightBalancePromise === runSync) {
                inFlightBalancePromise = null;
                inFlightBalanceUserId = null;
            }
        });
        return inFlightBalancePromise;
    },

    logout: async () => {
        inFlightBalancePromise = null;
        inFlightBalanceUserId = null;
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        set({
            user: null,
            role: null,
            balance: 0,
            lastBalanceSyncAt: 0,
            unreadCount: 0,
            sessionStatus: 'unauthenticated',
            serverUserSynced: false,
            lastAuthMeAt: 0,
            bootAuthMeInFlight: false,
        });
    }
}));
