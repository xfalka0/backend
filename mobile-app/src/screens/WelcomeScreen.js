import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    Dimensions,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeIn,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withDelay,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import FloatingProfiles from '../components/animated/FloatingProfiles';
import WelcomeButton from '../components/ui/WelcomeButton';
import { COLORS } from '../theme';

const { width, height } = Dimensions.get('window');

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export default function WelcomeScreen({ navigation }) {
    const bubbleY = useSharedValue(0);

    useEffect(() => {
        bubbleY.value = withRepeat(
            withSequence(
                withSpring(-10, { damping: 10, stiffness: 100 }),
                withSpring(0, { damping: 10, stiffness: 100 })
            ),
            -1,
            true
        );
    }, []);

    const bubbleStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: bubbleY.value }],
    }));

    return (
        <View style={styles.container}>
            {/* Background Gradient */}
            <LinearGradient
                colors={['#0f172a', '#1e1b4b', '#4c1d95', '#1e1b4b', '#0f172a']}
                style={StyleSheet.absoluteFill}
            />

            {/* Animated Profile Background */}
            <FloatingProfiles />

            {/* Overlay Gradient for Readability */}
            <LinearGradient
                colors={['rgba(15, 23, 42, 0.4)', 'rgba(15, 23, 42, 0.8)', '#0f172a']}
                style={StyleSheet.absoluteFill}
            />

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

                        {/* Online Badge - Moved under logo */}
                        <Animated.View style={[styles.onlineBubble, bubbleStyle]}>
                            <BlurView intensity={30} style={styles.bubbleBlur}>
                                <Text style={styles.bubbleText}>🔥 Şu an 128 kişi online</Text>
                            </BlurView>
                        </Animated.View>
                    </Animated.View>

                    <View style={styles.bottomSection}>
                        {/* Title & Subtitle */}
                        <Animated.View entering={FadeInUp.delay(500).springify()}>
                            <Text style={styles.title}>Yeni insanlarla tanış</Text>
                            <Text style={styles.subtitle}>Sohbet et, bağlan, eğlen</Text>
                        </Animated.View>

                        <View style={styles.buttonContainer}>
                            <Animated.View entering={FadeInUp.delay(700).springify()}>
                                <WelcomeButton
                                    title="Telefon ile devam et"
                                    icon="call-outline"
                                    onPress={() => navigation.navigate('Auth', { mode: 'phone' })}
                                />
                            </Animated.View>

                            <Animated.View entering={FadeInUp.delay(850).springify()}>
                                <WelcomeButton
                                    title="Google ile devam et"
                                    icon="logo-google"
                                    onPress={() => navigation.navigate('Auth', { mode: 'google' })}
                                />
                            </Animated.View>

                            <Animated.View entering={FadeInUp.delay(1000).springify()}>
                                <WelcomeButton
                                    title="E-posta ile devam et"
                                    icon="mail-outline"
                                    variant="gradient"
                                    onPress={() => navigation.navigate('Auth', { mode: 'email' })}
                                />
                            </Animated.View>
                        </View>

                        {/* Footer */}
                        <Animated.View entering={FadeIn.delay(1200)} style={styles.footer}>
                            <Text style={styles.footerText}>
                                Devam ederek{' '}
                                <Text style={styles.link}>Şartlar</Text> ve{' '}
                                <Text style={styles.link}>Gizlilik Politikasını</Text> kabul etmiş olursun.
                            </Text>
                        </Animated.View>
                    </View>
                </View>
            </SafeAreaView>
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
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginTop: height * 0.1,
    },
    logoCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        padding: 3,
        backgroundColor: 'rgba(255,255,255,0.2)',
        ...Platform.select({
            ios: {
                shadowColor: '#ec4899',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 15,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    logoGradient: {
        flex: 1,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomSection: {
        width: '100%',
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
    },
    footer: {
        marginTop: 30,
        paddingHorizontal: 20,
    },
    footerText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
    },
    link: {
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    onlineBubble: {
        marginTop: 20,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
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
});
