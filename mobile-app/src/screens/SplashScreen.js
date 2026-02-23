import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSequence,
    withSpring,
    withDelay,
    withRepeat,
    Easing
} from 'react-native-reanimated';
import axios from 'axios';
import { API_URL } from '../config';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
    // Animation Values
    const scale = useSharedValue(0.95);
    const textOpacity = useSharedValue(0);
    const textTranslateY = useSharedValue(20);

    // Background Animation Value (0 -> 1 -> 0)
    const gradientOpacity = useSharedValue(0);

    useEffect(() => {
        // Background Animation (0 -> 1 -> 0)
        gradientOpacity.value = withRepeat(
            withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
            -1,
            true
        );

        // Text Entrance & Continuous Pulse (Even more subtle and slow)
        textTranslateY.value = withTiming(0, { duration: 2500, easing: Easing.out(Easing.ease) });
        textOpacity.value = withTiming(1, { duration: 2500 });
        scale.value = withSequence(
            withTiming(1, { duration: 2500, easing: Easing.out(Easing.ease) }),
            withRepeat(
                withSequence(
                    withTiming(1.04, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            )
        );

        const triggerExit = (routeName, params) => {
            // Exit Transition: Very subtle scale-up & snap fade out
            scale.value = withTiming(1.5, { duration: 400, easing: Easing.out(Easing.ease) });
            textOpacity.value = withTiming(0, { duration: 300 });
            gradientOpacity.value = withTiming(0, { duration: 300 });

            setTimeout(() => {
                navigation.replace(routeName, params);
            }, 300);
        };

        const checkSession = async () => {
            try {
                // Log start
                console.log('[Splash] Checking session...');

                const token = await AsyncStorage.getItem('token');
                const userJson = await AsyncStorage.getItem('user');

                let userData = null;
                try {
                    userData = userJson ? JSON.parse(userJson) : null;
                } catch (e) {
                    console.warn('[Splash] Corrupt user data, clearing.');
                    await AsyncStorage.multiRemove(['token', 'user']);
                    triggerExit('Welcome');
                    return;
                }

                if (token && userData) {
                    try {
                        console.log('[Splash] Validating token with server...');
                        const res = await axios.get(`${API_URL}/auth/me`, {
                            headers: { Authorization: `Bearer ${token}` },
                            timeout: 10000
                        });

                        const freshUser = res.data;
                        await AsyncStorage.setItem('user', JSON.stringify(freshUser));
                        console.log('[Splash] Session valid, navigating to Main');

                        if (freshUser.onboarding_completed !== false) {
                            triggerExit('Main', { user: { ...freshUser, token } });
                        } else {
                            triggerExit('Onboarding', { userId: freshUser.id, token });
                        }
                    } catch (verifyErr) {
                        console.warn("[Session] Token verification failed:", verifyErr.message);
                        await AsyncStorage.multiRemove(['token', 'user']);
                        triggerExit('Welcome');
                    }
                } else {
                    console.log('[Splash] No session found, navigating to Welcome');
                    triggerExit('Welcome');
                }
            } catch (err) {
                console.error("Session Check Error:", err);
                triggerExit('Welcome');
            }
        };

        // Start the session check after a shorter delay
        const timer = setTimeout(checkSession, 1000);
        return () => clearTimeout(timer);
    }, []);

    const animatedGradientStyle = useAnimatedStyle(() => ({
        opacity: gradientOpacity.value,
    }));

    const animatedTextStyle = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
        transform: [{ translateY: textTranslateY.value }, { scale: scale.value }],
    }));

    return (
        <View style={styles.container} pointerEvents="none">
            <StatusBar barStyle="dark-content" />

            {/* Layer 1: Base Gradient (Static) - WHITE/PASTEL */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <LinearGradient
                    // Bembeyazdan çok açık lila/pembe tonlarına
                    colors={['#ffffff', '#fdf4ff', '#fae8ff']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.background}
                />
            </View>

            {/* Layer 2: Overlay Gradient (Animated Opacity) - SLIGHTLY DIFFERENT WHITE/PASTEL */}
            <Animated.View style={[StyleSheet.absoluteFill, animatedGradientStyle]} pointerEvents="none">
                <LinearGradient
                    // Bembeyazdan çok açık mavi/indigo tonlarına
                    colors={['#ffffff', '#f5f3ff', '#ede9fe']}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={styles.background}
                />
            </Animated.View>

            <Animated.View
                pointerEvents="none"
                style={[styles.contentContainer, animatedTextStyle]}
            >
                <Text style={styles.brandText}>Fiva</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
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
        // Arkaplan beyaz olduğu için yazı artık Koyu Mor/Lacivert olmalı
        color: '#2e1065',
        // Text Shadow/Glow tamamen kaldırıldı
    }
});
