import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
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
    const scale = useSharedValue(0.8);
    const textOpacity = useSharedValue(0);
    const textTranslateY = useSharedValue(20);

    // Background Animation Value (0 -> 1 -> 0)
    const gradientOpacity = useSharedValue(0);

    useEffect(() => {
        // Continuous Background Animation: Smoothly pulse between two gradients
        // 0 -> 1 -> 0 (Infinite)
        gradientOpacity.value = withRepeat(
            withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
            -1, // Infinite
            true // Reverse (ping-pong)
        );

        // Text Animation
        scale.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) });
        textOpacity.value = withDelay(300, withTiming(1, { duration: 800 }));
        textTranslateY.value = withDelay(300, withSpring(0, { damping: 12 }));

        const checkSession = async () => {
            try {
                const token = await AsyncStorage.getItem('token');
                const userJson = await AsyncStorage.getItem('user');
                const userData = userJson ? JSON.parse(userJson) : null;

                if (token && userData) {
                    try {
                        const res = await axios.get(`${API_URL}/auth/me`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const freshUser = res.data;
                        await AsyncStorage.setItem('user', JSON.stringify(freshUser));

                        if (freshUser.onboarding_completed) {
                            navigation.replace('Main', { user: { ...freshUser, token } });
                        } else {
                            navigation.replace('Onboarding', { userId: freshUser.id, token });
                        }
                    } catch (verifyErr) {
                        console.warn("[Session] Token verification failed:", verifyErr.message);
                        if (verifyErr.response?.status === 401 || verifyErr.response?.status === 403) {
                            await AsyncStorage.multiRemove(['token', 'user']);
                        }
                        navigation.replace('Welcome');
                    }
                } else {
                    navigation.replace('Welcome');
                }
            } catch (err) {
                console.error("Session Check Error:", err);
                navigation.replace('Welcome');
            }
        };

        const timer = setTimeout(checkSession, 2500);
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
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Layer 1: Base Gradient (Static) - WHITE/PASTEL */}
            <View style={StyleSheet.absoluteFill}>
                <LinearGradient
                    // Bembeyazdan çok açık lila/pembe tonlarına
                    colors={['#ffffff', '#fdf4ff', '#fae8ff']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.background}
                />
            </View>

            {/* Layer 2: Overlay Gradient (Animated Opacity) - SLIGHTLY DIFFERENT WHITE/PASTEL */}
            <Animated.View style={[StyleSheet.absoluteFill, animatedGradientStyle]}>
                <LinearGradient
                    // Bembeyazdan çok açık mavi/indigo tonlarına
                    colors={['#ffffff', '#f5f3ff', '#ede9fe']}
                    start={{ x: 0.2, y: 0 }}
                    end={{ x: 0.8, y: 1 }}
                    style={styles.background}
                />
            </Animated.View>

            <Animated.View style={[styles.contentContainer, animatedTextStyle]}>
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
