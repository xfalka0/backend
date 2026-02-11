import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    interpolate,
    useSharedValue,
} from 'react-native-reanimated';
import SafeLottie from './SafeLottie';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;

const VIP_CONFIGS = {
    1: {
        title: 'VIP 1',
        colors: ['#94a3b8', '#475569'],
        glow: 'rgba(148, 163, 184, 0.3)',
        benefits: ['Öncelikli Eşleşme', 'Temel Rozet'],
        icon: 'star'
    },
    2: {
        title: 'VIP 2',
        colors: ['#3b82f6', '#1d4ed8'],
        glow: 'rgba(59, 130, 246, 0.4)',
        benefits: ['Öncelikli Eşleşme', 'Mavi Rozet', 'Haftalık Hediye'],
        icon: 'ribbon'
    },
    3: {
        title: 'VIP 3',
        colors: ['#a855f7', '#701a75'],
        glow: 'rgba(168, 85, 247, 0.5)',
        benefits: ['Özel Hediyeler', 'Pembe Rozet', 'Arama %10 İndirim'],
        icon: 'diamond'
    },
    4: {
        title: 'VIP 4',
        colors: ['#fbbf24', '#b45309'],
        glow: 'rgba(251, 191, 36, 0.6)',
        benefits: ['Lüks Görünüm', 'Altın Rozet', 'Özel Hizmet'],
        icon: 'shield-checkmark'
    },
    5: {
        title: 'VIP 5',
        colors: ['#fbbf24', '#be185d', '#7c3aed'],
        glow: 'rgba(244, 114, 182, 0.7)',
        benefits: ['Halo Efekti', 'Premium Rozet+', 'Sınırsız Mesaj'],
        icon: 'flame'
    },
    6: {
        title: 'VIP 6',
        colors: ['#000000', '#1a1a1a', '#451a03'],
        glow: 'rgba(251, 191, 36, 0.8)',
        benefits: ['Ultimate Haklar', 'Efsanevi Rozet', 'Konum Gizleme', 'Oda Kurma Yetkisi'],
        icon: 'crown',
        isUltimate: true
    }
};

const VipCard = ({ level, userAvatar }) => {
    const config = VIP_CONFIGS[level] || VIP_CONFIGS[1];
    const pulseValue = useSharedValue(1);
    const shineValue = useSharedValue(-CARD_WIDTH);

    useEffect(() => {
        pulseValue.value = withRepeat(
            withSequence(
                withTiming(1.05, { duration: 1500 }),
                withTiming(1, { duration: 1500 })
            ),
            -1,
            true
        );

        shineValue.value = withRepeat(
            withTiming(CARD_WIDTH * 2, { duration: 3000 }),
            -1,
            false
        );
    }, [level]);

    const animatedGlow = useAnimatedStyle(() => ({
        transform: [{ scale: pulseValue.value }],
        shadowOpacity: interpolate(pulseValue.value, [1, 1.05], [0.3, 0.6]),
    }));

    const animatedShine = useAnimatedStyle(() => ({
        transform: [{ translateX: shineValue.value }],
    }));

    return (
        <View style={styles.container}>
            <Animated.View style={[
                styles.card,
                { shadowColor: config.glow },
                animatedGlow
            ]}>
                <LinearGradient
                    colors={config.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradient}
                >
                    {/* Shine Effect for VIP 3+ */}
                    {level >= 3 && (
                        <Animated.View style={[styles.shineContainer, animatedShine]}>
                            <LinearGradient
                                colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.shineGradient}
                            />
                        </Animated.View>
                    )}

                    {/* VIP 6 Special: Rays of Light */}
                    {level === 6 && (
                        <View style={StyleSheet.absoluteFill}>
                            <SafeLottie
                                source={require('../../assets/lottie/vip_particles.json')}
                                style={styles.lottieOverlay}
                                fallback={
                                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                        <Ionicons name="sparkles" size={200} color="rgba(251, 191, 36, 0.05)" />
                                    </View>
                                }
                            />
                        </View>
                    )}

                    <View style={styles.header}>
                        <View style={styles.levelBadge}>
                            <Text style={styles.levelText}>{config.title}</Text>
                        </View>
                        <Ionicons name={config.icon} size={32} color="white" />
                    </View>

                    <View style={styles.avatarContainer}>
                        <Image
                            source={{ uri: userAvatar || 'https://ui-avatars.com/api/?name=User&background=random&color=fff' }}
                            style={[styles.avatar, level === 6 && styles.ultimateAvatar]}
                        />
                        {level === 6 && (
                            <SafeLottie
                                source={require('../../assets/lottie/vip_crown.json')}
                                style={styles.crownLottie}
                                fallback={
                                    <View style={{ position: 'absolute', top: -35, left: 10 }}>
                                        <Ionicons name="ribbon" size={44} color="#fbbf24" />
                                    </View>
                                }
                            />
                        )}
                    </View>

                    <Text style={styles.premiumText}>PREMIUM ÜYE</Text>

                    <View style={styles.benefitsContainer}>
                        {config.benefits.map((benefit, index) => (
                            <View key={index} style={styles.benefitRow}>
                                <Ionicons name="checkmark-done-circle" size={16} color="rgba(255,255,255,0.9)" />
                                <Text style={styles.benefitText}>{benefit}</Text>
                            </View>
                        ))}
                    </View>
                </LinearGradient>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: width,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    card: {
        width: CARD_WIDTH,
        height: CARD_WIDTH * 1.35,
        borderRadius: 40,
        backgroundColor: '#1e293b',
        elevation: 25,
        shadowOffset: { width: 0, height: 15 },
        shadowRadius: 25,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    gradient: {
        flex: 1,
        padding: 24,
        alignItems: 'center',
    },
    shineContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '40%',
        height: '100%',
        transform: [{ skewX: '-30deg' }],
        zIndex: 1,
    },
    shineGradient: {
        flex: 1,
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        zIndex: 2,
    },
    levelBadge: {
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 25,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    levelText: {
        color: 'white',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 3,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    avatarContainer: {
        position: 'relative',
        marginVertical: 15,
        zIndex: 2,
    },
    avatar: {
        width: 110,
        height: 110,
        borderRadius: 55,
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.6)',
    },
    ultimateAvatar: {
        borderColor: '#fbbf24',
        shadowColor: '#fbbf24',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 20,
    },
    crownLottie: {
        position: 'absolute',
        top: -45,
        left: -20,
        width: 150,
        height: 150,
    },
    lottieOverlay: {
        width: '100%',
        height: '100%',
        position: 'absolute',
        opacity: 0.8,
    },
    premiumText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 6,
        textTransform: 'uppercase',
        opacity: 0.95,
        marginTop: 5,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    benefitsContainer: {
        width: '100%',
        marginTop: 25,
        backgroundColor: 'rgba(0,0,0,0.25)',
        padding: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        gap: 12,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    benefitText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
        opacity: 0.95,
    }
});

export default VipCard;
