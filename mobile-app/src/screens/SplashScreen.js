import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, StatusBar, Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { API_URL } from '../config';
import { useAppStore } from '../store/useAppStore';
import { resetTo } from '../services/navigationRef';
import { useMotionPreferences } from '../utils/useScreenActive';

const { width, height } = Dimensions.get('window');

const AUTH_ME_BOOT_WAIT_MS = 2000;
const CINEMATIC_HOLD_MS = 2550;
const REDUCED_HOLD_MS = 600;
const EXIT_DURATION_MS = 450; // 2550 + 450 = 3000ms (3 saniye)

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
    const { reducedMotion, isLowPerf } = useMotionPreferences();
    const isReducedRef = useRef(reducedMotion || isLowPerf);
    isReducedRef.current = reducedMotion || isLowPerf;

    // GPU-composited native driver animated values (opacity & transform only)
    const sheenTranslateX = useRef(new Animated.Value(-width * 0.85)).current;
    const sheenOpacity = useRef(new Animated.Value(0)).current;
    const brandOpacity = useRef(new Animated.Value(0)).current;
    const brandTranslateY = useRef(new Animated.Value(16)).current;
    const brandScale = useRef(new Animated.Value(0.94)).current;
    const lineScaleX = useRef(new Animated.Value(0)).current;
    const lineOpacity = useRef(new Animated.Value(0)).current;
    const studioOpacity = useRef(new Animated.Value(0)).current;
    const studioTranslateY = useRef(new Animated.Value(10)).current;
    const studioScale = useRef(new Animated.Value(0.97)).current;
    const exitOpacity = useRef(new Animated.Value(1)).current;
    const exitScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        let isCancelled = false;
        let holdTimerId;
        const lowMotion = isReducedRef.current;

        const minHoldPromise = new Promise((resolve) => {
            holdTimerId = setTimeout(resolve, lowMotion ? REDUCED_HOLD_MS : CINEMATIC_HOLD_MS);
        });

        let introAnim;
        let driftAnim;

        if (lowMotion) {
            introAnim = Animated.parallel([
                Animated.timing(brandOpacity, {
                    toValue: 1,
                    duration: 320,
                    useNativeDriver: true,
                }),
                Animated.timing(brandTranslateY, {
                    toValue: 0,
                    duration: 320,
                    useNativeDriver: true,
                }),
                Animated.timing(brandScale, {
                    toValue: 1,
                    duration: 320,
                    useNativeDriver: true,
                }),
                Animated.timing(lineScaleX, {
                    toValue: 1,
                    duration: 320,
                    useNativeDriver: true,
                }),
                Animated.timing(lineOpacity, {
                    toValue: 0.8,
                    duration: 320,
                    useNativeDriver: true,
                }),
                Animated.timing(studioOpacity, {
                    toValue: 0.85,
                    duration: 320,
                    useNativeDriver: true,
                }),
                Animated.timing(studioTranslateY, {
                    toValue: 0,
                    duration: 320,
                    useNativeDriver: true,
                }),
                Animated.timing(studioScale, {
                    toValue: 1,
                    duration: 320,
                    useNativeDriver: true,
                }),
            ]);
            introAnim.start();
        } else {
            const cinemaEase = Easing.bezier(0.22, 1, 0.36, 1);
            const silkEase = Easing.inOut(Easing.sin);

            introAnim = Animated.parallel([
                // 1. Subtle diagonal silk sheen sweeping across the dark backdrop (no circles)
                Animated.sequence([
                    Animated.delay(150),
                    Animated.parallel([
                        Animated.timing(sheenTranslateX, {
                            toValue: width * 0.95,
                            duration: 2350,
                            easing: silkEase,
                            useNativeDriver: true,
                        }),
                        Animated.sequence([
                            Animated.timing(sheenOpacity, {
                                toValue: 1,
                                duration: 950,
                                easing: Easing.out(Easing.quad),
                                useNativeDriver: true,
                            }),
                            Animated.timing(sheenOpacity, {
                                toValue: 0,
                                duration: 1400,
                                easing: Easing.in(Easing.quad),
                                useNativeDriver: true,
                            }),
                        ]),
                    ]),
                ]),

                // 2. Fiora wordmark glides smoothly into focus
                Animated.sequence([
                    Animated.delay(120),
                    Animated.parallel([
                        Animated.timing(brandOpacity, {
                            toValue: 1,
                            duration: 1100,
                            easing: Easing.out(Easing.quad),
                            useNativeDriver: true,
                        }),
                        Animated.timing(brandTranslateY, {
                            toValue: 0,
                            duration: 1350,
                            easing: cinemaEase,
                            useNativeDriver: true,
                        }),
                        Animated.timing(brandScale, {
                            toValue: 1,
                            duration: 1450,
                            easing: cinemaEase,
                            useNativeDriver: true,
                        }),
                    ]),
                ]),

                // 3. Razor-thin luxury divider expands cleanly from center
                Animated.sequence([
                    Animated.delay(480),
                    Animated.parallel([
                        Animated.timing(lineOpacity, {
                            toValue: 0.9,
                            duration: 750,
                            easing: Easing.out(Easing.quad),
                            useNativeDriver: true,
                        }),
                        Animated.timing(lineScaleX, {
                            toValue: 1,
                            duration: 1050,
                            easing: cinemaEase,
                            useNativeDriver: true,
                        }),
                    ]),
                ]),

                // 4. FALKASOFT signature fades up smoothly below
                Animated.sequence([
                    Animated.delay(720),
                    Animated.parallel([
                        Animated.timing(studioOpacity, {
                            toValue: 0.88,
                            duration: 1050,
                            easing: Easing.out(Easing.quad),
                            useNativeDriver: true,
                        }),
                        Animated.timing(studioTranslateY, {
                            toValue: 0,
                            duration: 1100,
                            easing: cinemaEase,
                            useNativeDriver: true,
                        }),
                        Animated.timing(studioScale, {
                            toValue: 1,
                            duration: 1150,
                            easing: cinemaEase,
                            useNativeDriver: true,
                        }),
                    ]),
                ]),
            ]);

            introAnim.start(({ finished }) => {
                if (finished && !isCancelled) {
                    driftAnim = Animated.timing(brandScale, {
                        toValue: 1.03,
                        duration: 1400,
                        easing: silkEase,
                        useNativeDriver: true,
                    });
                    driftAnim.start();
                }
            });
        }

        const playExitTransition = () => new Promise((resolve) => {
            if (isCancelled) {
                resolve();
                return;
            }
            const duration = isReducedRef.current ? 220 : EXIT_DURATION_MS;
            Animated.parallel([
                Animated.timing(exitOpacity, {
                    toValue: 0,
                    duration,
                    easing: Easing.inOut(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(exitScale, {
                    toValue: isReducedRef.current ? 1 : 1.02,
                    duration,
                    easing: Easing.inOut(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start(() => resolve());
        });

        const finishAndNavigate = async (action) => {
            await minHoldPromise;
            if (isCancelled) return;
            await playExitTransition();
            if (isCancelled) return;
            await action();
        };

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
                    await finishAndNavigate(() => navigation.replace('Welcome'));
                    return;
                }

                if (!token || !userData) {
                    useAppStore.getState().setSessionStatus('unauthenticated');
                    await finishAndNavigate(() => navigation.replace('Welcome'));
                    return;
                }

                if (token === 'mock-test-token-12345' || userData?.id === 9999) {
                    await AsyncStorage.multiRemove(['token', 'user']);
                    useAppStore.getState().setSessionStatus('unauthenticated');
                    await finishAndNavigate(() => navigation.replace('Welcome'));
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
                    await finishAndNavigate(() => clearInvalidSessionAndGoAuth(token, navigation));
                    return;
                }

                if (outcome.kind === 'ok' && outcome.freshUser) {
                    const freshUser = outcome.freshUser;
                    const applied = await applyFreshUser(token, freshUser, false);
                    if (!applied || isCancelled) return;

                    await finishAndNavigate(() => {
                        if (freshUser.onboarding_completed !== false) {
                            navigation.replace('Main', { user: { ...freshUser, token } });
                        } else {
                            navigation.replace('Onboarding', { userId: freshUser.id, token });
                        }
                    });
                    return;
                }

                // Timed out (>2000ms) or network unreachable: open cached session and continue verifying in background
                await finishAndNavigate(() => {
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
                });
            } catch (err) {
                console.error('Session Check Error:', err);
                if (!isCancelled) {
                    useAppStore.getState().setSessionStatus('unauthenticated');
                    await finishAndNavigate(() => navigation.replace('Welcome'));
                }
            }
        };

        checkSession();
        return () => {
            isCancelled = true;
            clearTimeout(holdTimerId);
            introAnim?.stop();
            driftAnim?.stop();
        };
    }, [navigation, sheenTranslateX, sheenOpacity, brandOpacity, brandTranslateY, brandScale, lineScaleX, lineOpacity, studioOpacity, studioTranslateY, studioScale, exitOpacity, exitScale]);

    return (
        <View style={styles.container} pointerEvents="none">
            <StatusBar barStyle="light-content" />

            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <LinearGradient
                    colors={['#0F080A', '#170A0F', '#230D16', '#0F080A']}
                    locations={[0, 0.35, 0.72, 1]}
                    start={{ x: 0.15, y: 0 }}
                    end={{ x: 0.85, y: 1 }}
                    style={styles.background}
                />
            </View>

            <Animated.View
                pointerEvents="none"
                style={[styles.stageWrapper, { opacity: exitOpacity }]}
            >
                {/* Lightweight diagonal silk sheen sweep (zero circular shapes) */}
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.sheenWrapper,
                        {
                            opacity: sheenOpacity,
                            transform: [
                                { translateX: sheenTranslateX },
                                { rotate: '-20deg' },
                            ],
                        },
                    ]}
                >
                    <LinearGradient
                        colors={[
                            'transparent',
                            'rgba(236, 72, 153, 0.045)',
                            'rgba(255, 255, 255, 0.032)',
                            'rgba(168, 85, 247, 0.04)',
                            'transparent',
                        ]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.sheenGradient}
                    />
                </Animated.View>

                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.contentContainer,
                        {
                            transform: [{ scale: exitScale }],
                        },
                    ]}
                >
                    <Animated.View
                        style={{
                            opacity: brandOpacity,
                            transform: [
                                { translateY: brandTranslateY },
                                { scale: brandScale },
                            ],
                        }}
                    >
                        <Text style={styles.brandText}>Fiora</Text>
                    </Animated.View>

                    <Animated.View
                        style={[
                            styles.accentLineWrapper,
                            {
                                opacity: lineOpacity,
                                transform: [{ scaleX: lineScaleX }],
                            },
                        ]}
                    >
                        <LinearGradient
                            colors={[
                                'transparent',
                                'rgba(244, 114, 182, 0.7)',
                                'rgba(255, 238, 246, 0.85)',
                                'rgba(192, 132, 252, 0.7)',
                                'transparent',
                            ]}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={styles.accentLine}
                        />
                    </Animated.View>

                    <Animated.Text
                        style={[
                            styles.studioText,
                            {
                                opacity: studioOpacity,
                                transform: [
                                    { translateY: studioTranslateY },
                                    { scale: studioScale },
                                ],
                            },
                        ]}
                    >
                        FALKASOFT
                    </Animated.Text>
                </Animated.View>
            </Animated.View>
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
    stageWrapper: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    sheenWrapper: {
        position: 'absolute',
        width: width * 0.72,
        height: height * 1.45,
    },
    sheenGradient: {
        width: '100%',
        height: '100%',
    },
    contentContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    brandText: {
        fontSize: 66,
        fontFamily: 'Outfit_800ExtraBold',
        letterSpacing: 3,
        color: '#ffffff',
    },
    accentLineWrapper: {
        marginTop: 14,
        width: 124,
        height: 1,
        overflow: 'hidden',
    },
    accentLine: {
        width: '100%',
        height: '100%',
    },
    studioText: {
        marginTop: 14,
        fontSize: 12,
        fontFamily: 'Outfit_300Light',
        letterSpacing: 7.5,
        color: '#F5D8E6',
        paddingLeft: 7.5,
    },
});
