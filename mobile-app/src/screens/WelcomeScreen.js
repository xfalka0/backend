import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    Dimensions,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeIn,
    FadeOut,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    withSequence,
    interpolate,
    withSpring,
    withDelay,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

import FloatingProfiles from '../components/animated/FloatingProfiles';
import WelcomeButton from '../components/ui/WelcomeButton';
import { COLORS } from '../theme';
import { API_URL } from '../config';

const { width, height } = Dimensions.get('window');

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

const LoadingHeart = () => {
    const scale = useSharedValue(1);

    useEffect(() => {
        scale.value = withRepeat(
            withSequence(
                withTiming(1.2, { duration: 600 }),
                withTiming(1, { duration: 600 })
            ),
            -1
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    return (
        <Animated.View style={[styles.loadingHeartContainer, animatedStyle]}>
            <LinearGradient
                colors={['#8b5cf6', '#ec4899']}
                style={styles.loadingHeartGradient}
            >
                <Ionicons name="heart" size={40} color="white" />
            </LinearGradient>
        </Animated.View>
    );
};

export default function WelcomeScreen({ navigation }) {
    const bubbleY = useSharedValue(0);
    const [loading, setLoading] = useState(false);
    const [onlineCount, setOnlineCount] = useState(72);

    useEffect(() => {
        console.log('--- WelcomeScreen Mounted ---');
        bubbleY.value = withRepeat(
            withSequence(
                withSpring(-10, { damping: 10, stiffness: 100 }),
                withSpring(0, { damping: 10, stiffness: 100 })
            ),
            -1,
            true
        );

        try {
            console.log('--- Configuring Google Sign-in ---');
            GoogleSignin.configure({
                webClientId: '46669084263-drv76chuoahgvfitcdmctvvqm3cbudl7.apps.googleusercontent.com',
                offlineAccess: true,
            });
        } catch (err) {
            console.error('GoogleSignin Config Error:', err);
        }

        const interval = setInterval(() => {
            setOnlineCount(prev => prev + (Math.floor(Math.random() * 5) - 2));
        }, 3000);

        return () => {
            console.log('--- WelcomeScreen Unmounted ---');
            clearInterval(interval);
        };
    }, []);

    const bubbleStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: bubbleY.value }],
    }));

    const handleGoogleLogin = async () => {
        console.log('--- Google Login Clicked ---');
        if (loading) return;
        setLoading(true);
        try {
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            const idToken = userInfo.idToken;

            // Verify with backend
            const res = await axios.post(`${API_URL}/auth/google`, { idToken });

            if (res.data.user) {
                const { user, token } = res.data;
                await AsyncStorage.setItem('token', token);
                await AsyncStorage.setItem('user', JSON.stringify(user));

                if (user.onboarding_completed) {
                    navigation.replace('Main', { user: { ...user, token } });
                } else {
                    navigation.replace('Onboarding', { userId: user.id, token });
                }
            }
        } catch (error) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                // ignore
            } else if (error.code === statusCodes.IN_PROGRESS) {
                // ignore
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                Alert.alert('Hata', 'Google Play Servisleri güncel değil.');
            } else {
                Alert.alert('Giriş Hatası', `Google ile giriş yapılamadı.\nHata: ${error.message || error.code || 'Bilinmiyor'}`);
                console.error('Google Sign-in Error:', error);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleTestLogin = async () => {
        if (loading) return;
        setLoading(true);
        try {
            // 1. Ensure Test User Exists
            await axios.post(`${API_URL}/admin/create-simple-user`);

            // 2. Login
            const res = await axios.post(`${API_URL}/auth/login-email`, { email: '1', password: '1' });

            if (res.data.user) {
                const { user, token } = res.data;
                await AsyncStorage.setItem('token', token);
                await AsyncStorage.setItem('user', JSON.stringify(user));
                navigation.replace('Main', { user: { ...user, token } });
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Test Giriş Hatası', error.message);
        } finally {
            setLoading(false);
        }
    };



    return (
        <View style={styles.container}>
            {/* 1. BACKGROUND LAYER (SAFE) */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <LinearGradient
                    colors={['#0f172a', '#1e1b4b', '#4c1d95', '#1e1b4b', '#0f172a']}
                    style={StyleSheet.absoluteFill}
                />
                <FloatingProfiles />
                <LinearGradient
                    colors={['rgba(15, 23, 42, 0.4)', 'rgba(15, 23, 42, 0.8)', '#0f172a']}
                    style={StyleSheet.absoluteFill}
                />
            </View>

            {/* 2. INTERACTIVE LAYER */}
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    {/* Top Logo Section */}
                    <Animated.View entering={FadeIn.delay(300).duration(1000)} style={styles.header}>
                        <View style={styles.logoCircle}>
                            <LinearGradient
                                colors={['#8b5cf6', '#ec4899']}
                                style={styles.logoGradient}
                            >
                                <Ionicons name="heart" size={40} color="white" />
                            </LinearGradient>
                        </View>
                        <Animated.View style={[styles.onlineBubble, bubbleStyle]}>
                            <View style={styles.bubbleBlur}>
                                <Text style={styles.bubbleText}>🔥 Şu an {onlineCount} kişi online</Text>
                            </View>
                        </Animated.View>
                    </Animated.View>

                    <View style={styles.bottomSection}>
                        <Animated.View
                            entering={FadeInUp.delay(500).springify()}
                            style={{ marginTop: -100, marginBottom: 20 }}
                        >
                            <Text style={styles.title}>Yeni insanlarla tanış</Text>
                        </Animated.View>

                        <Animated.View
                            entering={FadeInUp.delay(650).springify()}
                            style={{ marginTop: -30 }}
                        >
                            <Text style={styles.subtitle}>Sohbet et, bağlan, eğlen</Text>
                        </Animated.View>

                        <View style={styles.buttonContainer}>
                            <Animated.View
                                entering={FadeInUp.delay(850).springify()}
                                style={{ width: '90%', alignItems: 'center', marginTop: 150 }}
                            >
                                <WelcomeButton
                                    title="Google ile devam et"
                                    icon="logo-google"
                                    onPress={handleGoogleLogin}
                                    loading={loading}
                                    variant="gradient"
                                    gradient={['#4285F4', '#34b356ff', '#34b356ff', '#4285F4']}
                                />
                            </Animated.View>

                            <Animated.View entering={FadeInUp.delay(1000).springify()} style={styles.footerLinks}>
                                <Text style={styles.footerText}>
                                    Devam ederek{' '}
                                    <Text
                                        style={styles.linkText}
                                        onPress={() => {
                                            console.log('--- Navigating to Terms ---');
                                            navigation.navigate('Legal', { type: 'terms' });
                                        }}
                                    >
                                        Şartlar
                                    </Text>
                                    {' ve '}
                                    <Text
                                        style={styles.linkText}
                                        onPress={() => {
                                            console.log('--- Navigating to Privacy ---');
                                            navigation.navigate('Legal', { type: 'privacy' });
                                        }}
                                    >
                                        Gizlilik
                                    </Text>
                                    {' Politikasını kabul etmiş olursun.'}
                                </Text>
                            </Animated.View>
                        </View>
                    </View>
                </View>
            </SafeAreaView>

            {loading && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 10 }]}>
                    <Animated.View
                        entering={FadeIn.duration(400)}
                        exiting={FadeOut.duration(400)}
                        style={styles.loadingOverlay}
                    >
                        <LinearGradient
                            colors={['#0f172a', '#1e1b4b']}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.loadingContent}>
                            <LoadingHeart />
                            <Animated.Text
                                entering={FadeIn.delay(200)}
                                style={styles.loadingText}
                            >
                                Hazırlanıyor...
                            </Animated.Text>
                        </View>
                    </Animated.View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    safeArea: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 30,
        justifyContent: 'space-between',
        paddingBottom: height * 0.1,
        paddingTop: height * 0.05,
    },
    header: {
        alignItems: 'center',
    },
    logoCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        padding: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    logoGradient: {
        flex: 1,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    onlineBubble: {
        marginTop: 20,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    bubbleBlur: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    bubbleText: {
        color: 'white',
        fontSize: 13,
        fontWeight: '600',
    },
    bottomSection: {
        width: '100%',
        alignItems: 'center',
    },
    title: {
        fontSize: 34,
        fontWeight: '800',
        color: 'white',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginBottom: 40,
        fontWeight: '400',
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerLinks: {
        marginTop: 40,
        width: '100%',
        paddingHorizontal: 50, // Massive padding to force wrapping
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
    },
    linkText: {
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
    },
    loadingContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingHeartContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        padding: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginBottom: 20,
    },
    loadingHeartGradient: {
        flex: 1,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
        fontFamily: 'Outfit_800ExtraBold',
        letterSpacing: 1,
        opacity: 0.8,
    },
});
