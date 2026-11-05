import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    Dimensions,
    Platform,
    Alert,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeIn,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    withSequence,
    withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

import FloatingProfiles from '../components/animated/FloatingProfiles';
import WelcomeButton from '../components/ui/WelcomeButton';
import { API_URL } from '../config';

const { width, height } = Dimensions.get('window');

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
    const insets = useSafeAreaInsets();
    const bubbleY = useSharedValue(0);
    const [loading, setLoading] = useState(false);
    const [onlineCount, setOnlineCount] = useState(142);

    useEffect(() => {
        bubbleY.value = withRepeat(
            withSequence(
                withSpring(-8, { damping: 10, stiffness: 100 }),
                withSpring(0, { damping: 10, stiffness: 100 })
            ),
            -1,
            true
        );

        try {
            GoogleSignin.configure({
                webClientId: '46669084263-drv76chuoahgvfitcdmctvvqm3cbudl7.apps.googleusercontent.com',
                androidClientId: '46669084263-vk43fvjtff4f95ep61rr8cv5mvj4t1h6.apps.googleusercontent.com',
                offlineAccess: true,
            });
        } catch (err) {
            console.error('GoogleSignin Config Error:', err);
        }

        const interval = setInterval(() => {
            setOnlineCount(prev => {
                const change = Math.floor(Math.random() * 5) - 2;
                const newCount = prev + change;
                return newCount < 120 ? 120 : (newCount > 300 ? 300 : newCount);
            });
        }, 3000);

        return () => {
            clearInterval(interval);
        };
    }, []);

    const bubbleStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: bubbleY.value }],
    }));

    const handleGoogleLogin = async () => {
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
            <SafeAreaView style={[styles.safeArea, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
                <View style={styles.content}>
                    {/* Top Logo Section */}
                    <Animated.View entering={FadeIn.delay(200).duration(800)} style={styles.header}>
                        <View style={styles.logoContainer}>
                            <LinearGradient
                                colors={['#4a152e', '#230a17', '#12050c']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.logoGradient}
                            >
                                <Image
                                    source={require('../../assets/fiva_heart_clean.png')}
                                    style={styles.logoImage}
                                    resizeMode="contain"
                                />
                            </LinearGradient>
                        </View>
                        <Animated.View style={[styles.onlineBubble, bubbleStyle]}>
                            <View style={styles.bubbleBlur}>
                                <Text style={styles.bubbleText}>🔥 Şu an {onlineCount} kişi online</Text>
                            </View>
                        </Animated.View>
                    </Animated.View>

                    {/* Middle Section (Vertically Centered Title & Subtitle) */}
                    <View style={styles.middleSection}>
                        <Animated.View entering={FadeInUp.delay(400).duration(800)} style={styles.titleWrapper}>
                            <Text style={styles.title}>Fiva</Text>
                            <Text style={styles.subtitle}>Gerçek bağlantılar, samimi sohbetler.</Text>
                        </Animated.View>
                    </View>

                    {/* Bottom Section: Buttons & Footer */}
                    <View style={styles.bottomSection}>
                        <View style={styles.buttonContainer}>
                            <Animated.View entering={FadeInUp.delay(600).duration(800)} style={styles.buttonWrapper}>
                                <WelcomeButton
                                    title="Google ile Devam Et"
                                    icon="logo-google"
                                    onPress={handleGoogleLogin}
                                    loading={loading}
                                    variant="gradient"
                                    gradient={['#4285F4', '#34A853']}
                                />
                            </Animated.View>

                            <Animated.View entering={FadeInUp.delay(750).duration(800)} style={styles.buttonWrapper}>
                                <WelcomeButton
                                    title="E-posta ile Devam Et"
                                    icon="mail-outline"
                                    onPress={() => navigation.navigate('Auth', { mode: 'email' })}
                                    loading={loading}
                                    variant="gradient"
                                    gradient={['#8b5cf6', '#ec4899']}
                                />
                            </Animated.View>
                        </View>

                        <Animated.View entering={FadeInUp.delay(900).duration(800)} style={styles.footerLinks}>
                            <Text style={styles.footerText}>
                                Devam ederek{' '}
                                <Text style={styles.linkText} onPress={() => navigation.navigate('Legal', { type: 'terms' })}>
                                    Kullanım Koşulları
                                </Text>
                                'nı ve{' '}
                                <Text style={styles.linkText} onPress={() => navigation.navigate('Legal', { type: 'privacy' })}>
                                    Gizlilik Politikası
                                </Text>
                                'nı kabul etmiş olursunuz.
                            </Text>
                        </Animated.View>
                    </View>
                </View>
            </SafeAreaView>

            {loading && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 10 }]}>
                    <Animated.View
                        entering={FadeIn.duration(400)}
                        style={styles.loadingOverlay}
                    >
                        <LinearGradient
                            colors={['#0f172a', '#1e1b4b']}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.loadingContent}>
                            <LoadingHeart />
                            <Animated.View entering={FadeIn.delay(200)}>
                                <Text style={styles.loadingText}>Hazırlanıyor...</Text>
                            </Animated.View>
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
        paddingHorizontal: 28,
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
        paddingBottom: Platform.OS === 'ios' ? 24 : 32,
    },
    header: {
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 12 : 24,
    },
    logoContainer: {
        width: 86,
        height: 86,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.16)',
        backgroundColor: '#1b0c11',
        ...Platform.select({
            ios: {
                shadowColor: '#ec4899',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    logoGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
    },
    logoImage: {
        width: '100%',
        height: '100%',
    },
    onlineBubble: {
        marginTop: 14,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    bubbleBlur: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    bubbleText: {
        color: 'white',
        fontSize: 13,
        fontWeight: '600',
        fontFamily: 'Outfit_500Medium',
    },
    middleSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        paddingVertical: 10,
    },
    titleWrapper: {
        alignItems: 'center',
        width: '100%',
    },
    title: {
        fontSize: 34,
        fontWeight: '800',
        fontFamily: 'Outfit_800ExtraBold',
        color: 'white',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.75)',
        textAlign: 'center',
        fontFamily: 'Outfit_400Regular',
        fontWeight: '400',
        lineHeight: 22,
        paddingHorizontal: 16,
    },
    bottomSection: {
        width: '100%',
        alignItems: 'center',
        marginBottom: Platform.OS === 'ios' ? 48 : 68,
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    buttonWrapper: {
        width: '100%',
    },
    footerLinks: {
        marginTop: 30,
        width: '100%',
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerText: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
    },
    linkText: {
        color: 'rgba(255,255,255,0.75)',
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
