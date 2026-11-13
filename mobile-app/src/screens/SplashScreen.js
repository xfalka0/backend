import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { API_URL } from '../config';
import { useAppStore } from '../store/useAppStore';
import { resetTo } from '../services/navigationRef';

const { width, height } = Dimensions.get('window');

const AUTH_ME_BOOT_WAIT_MS = 2000;

const applyFreshUser = async (token, freshUser, navigateOnInvalidOnboarding = false) => {
    const currentToken = await AsyncStorage.getItem('token');
    if (!currentToken || currentToken !== token) return false;
    if (!freshUser) return false;
    await AsyncStorage.setItem('user', JSON.stringify(freshUser));
    const store = useAppStore.getState();
    store.setUser(freshUser);
    store.setServerAuthSync(true);
    store.setSessionStatus('verified');
    if (navigateOnInvalidOnboarding && freshUser.onboarding_completed === false) {
        resetTo('Onboarding', { userId: freshUser.id, token });
    }
    return true;
};

const clearInvalidSessionAndGoAuth = async (token, navigationRefOrNull) => {
    const currentToken = await AsyncStorage.getItem('token');
    if (currentToken && currentToken !== token) return;
    await AsyncStorage.multiRemove(['token', 'user']);
    await useAppStore.getState().logout();
    if (navigationRefOrNull) {
        navigationRefOrNull.replace('Auth');
    } else {
        resetTo('Auth');
    }
};

export default function SplashScreen({ navigation }) {
    useEffect(() => {
        let isCancelled = false;

        const checkSession = async () => {
            try {
                useAppStore.getState().setSessionStatus('pending');
                const [[, token], [, userJson]] = await AsyncStorage.multiGet(['token', 'user']);
                if (isCancelled) return;

                let userData = null;
                try {
                    userData = userJson ? JSON.parse(userJson) : null;
                } catch (e) {
                    console.warn('[Splash] Corrupt user data, clearing.');
                    await AsyncStorage.multiRemove(['token', 'user']);
                    useAppStore.getState().setSessionStatus('unauthenticated');
                    navigation.replace('Welcome');
                    return;
                }

                if (!token || !userData) {
                    useAppStore.getState().setSessionStatus('unauthenticated');
                    navigation.replace('Welcome');
                    return;
                }

                if (token === 'mock-test-token-12345' || userData?.id === 9999) {
                    await AsyncStorage.multiRemove(['token', 'user']);
                    useAppStore.getState().setSessionStatus('unauthenticated');
                    navigation.replace('Welcome');
                    return;
                }

                // Start single authoritative /auth/me check; keep alive even if >2000ms fallback triggers
                useAppStore.getState().setBootAuthMeInFlight(true);
                const meOutcomePromise = axios.get(`${API_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 10000
                }).then((res) => ({
                    kind: 'ok',
                    freshUser: res.data,
                })).catch((err) => {
                    const status = err?.response?.status;
                    if (status === 401 || status === 403) {
                        return { kind: 'auth_error', status };
                    }
                    return { kind: 'network_error', err };
                }).finally(() => {
                    useAppStore.getState().setBootAuthMeInFlight(false);
                });

                let bootTimerId;
                const timeoutPromise = new Promise((resolve) => {
                    bootTimerId = setTimeout(() => resolve({ kind: 'timeout' }), AUTH_ME_BOOT_WAIT_MS);
                });

                const outcome = await Promise.race([meOutcomePromise, timeoutPromise]);
                clearTimeout(bootTimerId);
                if (isCancelled) return;

                if (outcome.kind === 'auth_error') {
                    console.warn('[Session] Token rejected on boot, redirecting to Auth:', outcome.status);
                    await clearInvalidSessionAndGoAuth(token, navigation);
                    return;
                }

                if (outcome.kind === 'ok' && outcome.freshUser) {
                    const freshUser = outcome.freshUser;
                    const applied = await applyFreshUser(token, freshUser, false);
                    if (!applied || isCancelled) return;

                    if (freshUser.onboarding_completed !== false) {
                        navigation.replace('Main', { user: { ...freshUser, token } });
                    } else {
                        navigation.replace('Onboarding', { userId: freshUser.id, token });
                    }
                    return;
                }

                // Timed out (>2000ms) or network unreachable: open cached session and continue verifying in background
                const store = useAppStore.getState();
                store.setServerAuthSync(false);
                store.setUser(userData);
                store.setSessionStatus('verified');

                if (userData.onboarding_completed !== false) {
                    navigation.replace('Main', { user: { ...userData, token } });
                } else {
                    navigation.replace('Onboarding', { userId: userData.id, token });
                }

                if (outcome.kind === 'timeout') {
                    meOutcomePromise.then(async (lateOutcome) => {
                        if (lateOutcome.kind === 'ok' && lateOutcome.freshUser) {
                            await applyFreshUser(token, lateOutcome.freshUser, userData?.onboarding_completed !== false);
                        } else if (lateOutcome.kind === 'auth_error') {
                            console.warn('[Session] Late /auth/me rejected token, redirecting to Auth:', lateOutcome.status);
                            await clearInvalidSessionAndGoAuth(token, null);
                        }
                    });
                }
            } catch (err) {
                console.error('Session Check Error:', err);
                if (!isCancelled) {
                    useAppStore.getState().setSessionStatus('unauthenticated');
                    navigation.replace('Welcome');
                }
            }
        };

        checkSession();
        return () => { isCancelled = true; };
    }, [navigation]);

    return (
        <View style={styles.container} pointerEvents="none">
            <StatusBar barStyle="light-content" />

            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <LinearGradient
                    colors={['#0F080A', '#1B0C11', '#29101A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.background}
                />
            </View>

            <View pointerEvents="none" style={styles.contentContainer}>
                <Text style={styles.brandText}>Fiva</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F080A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    background: {
        width,
        height,
    },
    contentContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    brandText: {
        fontSize: 64,
        fontFamily: 'Outfit_800ExtraBold',
        letterSpacing: 2,
        color: '#ffffff',
    }
});
