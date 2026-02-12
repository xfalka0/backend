import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    Easing
} from 'react-native-reanimated';
import axios from 'axios';
import { API_URL } from '../config';
import { COLORS } from '../theme';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
    const scale = useSharedValue(0.3);
    const opacity = useSharedValue(0);

    useEffect(() => {
        // Animation sequence
        opacity.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.exp) });
        scale.value = withSpring(1, { damping: 12, stiffness: 90 });

        const checkSession = async () => {
            try {
                const token = await AsyncStorage.getItem('token');
                const userJson = await AsyncStorage.getItem('user');
                const userData = userJson ? JSON.parse(userJson) : null;

                if (token && userData) {
                    try {
                        // Verify token validity with backend
                        const res = await axios.get(`${API_URL}/auth/me`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        // Token valid, proceed to app
                        const freshUser = res.data;
                        await AsyncStorage.setItem('user', JSON.stringify(freshUser));

                        if (freshUser.onboarding_completed) {
                            navigation.replace('Main', { user: { ...freshUser, token } });
                        } else {
                            navigation.replace('Onboarding', { userId: freshUser.id, token });
                        }
                    } catch (verifyErr) {
                        console.warn("[Session] Token verification failed:", verifyErr.message);
                        // If 401 or 403, clear session and go to welcome
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

        const timer = setTimeout(checkSession, 2000);
        return () => clearTimeout(timer);
    }, []);

    const animatedLogoStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <View style={styles.container}>
            <Image
                source={require('../../assets/splash.png')}
                style={styles.backgroundImage}
                resizeMode="cover"
            />
            <LinearGradient
                colors={['transparent', 'rgba(15, 23, 42, 0.9)', '#0f172a']}
                style={styles.gradientOverlay}
            />

            <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
                <Image
                    source={require('../../assets/icon.png')}
                    style={styles.logo}
                />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backgroundImage: {
        ...StyleSheet.absoluteFillObject,
        width,
        height,
    },
    gradientOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 20,
    },
    logo: {
        width: 150,
        height: 150,
        borderRadius: 35,
    }
});
