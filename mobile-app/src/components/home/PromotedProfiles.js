import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from '../ui/GlassCard';
import { useTheme } from '../../contexts/ThemeContext';
import { Motion } from '../motion/MotionSystem';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    withDelay,
    Easing,
    interpolate
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

const ProfileItem = React.memo(({ profile, index, onPress, theme, sharedPulse, sharedRotation }) => {
    const scale = useSharedValue(1);

    const animatedGlowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(sharedPulse.value, [0, 1], [0.6, 1]),
        transform: [
            { scale: interpolate(sharedPulse.value, [0, 1], [1, 1.05]) },
            { rotate: `${sharedRotation.value}deg` }
        ],
    }));

    const animatedItemStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withTiming(0.92, { duration: 100, easing: Easing.out(Easing.ease) });
    };

    const handlePressOut = () => {
        scale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
    };

    return (
        <Motion.SlideUp delay={index * 100}>
            <Animated.View style={animatedItemStyle}>
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    onPress={() => onPress?.(profile)}
                    style={styles.profileItem}
                >
                    <View style={styles.avatarWrapper}>
                        {/* Pulsing Outer Glow - Standard premium ring for everyone */}
                        <AnimatedGradient
                            colors={['#ec4899', '#8b5cf6', '#ec4899']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.glowBorder, animatedGlowStyle]}
                        />

                        <View style={[styles.avatarContainer, { backgroundColor: theme.colors.glass }]}>
                            <Image
                                source={{ uri: profile.avatar_url }}
                                style={styles.avatar}
                                resizeMode="cover"
                            />
                        </View>

                        {/* Online Badge */}
                        {profile.is_online && (
                            <View style={styles.onlineBadge}>
                                <View style={styles.onlineInner} />
                            </View>
                        )}

                        {/* Action Label */}
                        <View style={styles.boostBadge}>
                            <Ionicons name="rocket" size={8} color="white" />
                        </View>
                    </View>
                    <Text
                        style={[styles.profileName, { color: theme.colors.text }]}
                        numberOfLines={1}
                    >
                        {profile.name?.split(' ')[0]}
                    </Text>
                </TouchableOpacity>
            </Animated.View>
        </Motion.SlideUp>
    );
});

export default function PromotedProfiles({ data = [], onProfilePress, user }) {
    const { theme, themeMode } = useTheme();

    // --- SHARED ANIMATIONS FOR PERFORMANCE ---
    const sharedPulse = useSharedValue(0);
    const sharedRotation = useSharedValue(0);
    const wiggle = useSharedValue(0);
    const driftX = useSharedValue(0);
    const driftY = useSharedValue(0);
    const shinePos = useSharedValue(-width);

    // Living Background Drift
    useEffect(() => {
        // 1. Sync Pulse & Rotation
        sharedPulse.value = withRepeat(
            withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
        sharedRotation.value = withRepeat(
            withTiming(360, { duration: 8000, easing: Easing.linear }),
            -1,
            false
        );

        // 2. Wiggle for Flame
        wiggle.value = withRepeat(
            withSequence(
                withTiming(18, { duration: 250, easing: Easing.out(Easing.ease) }),
                withTiming(-14, { duration: 400, easing: Easing.inOut(Easing.ease) }),
                withTiming(10, { duration: 350, easing: Easing.inOut(Easing.ease) }),
                withTiming(-6, { duration: 300, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 250, easing: Easing.in(Easing.ease) }),
                withDelay(2000, withTiming(0, { duration: 0 }))
            ),
            -1,
            false
        );

        // 3. BG Drift
        driftX.value = withRepeat(
            withSequence(
                withTiming(20, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
                withTiming(-20, { duration: 5000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
        driftY.value = withRepeat(
            withSequence(
                withTiming(-15, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
                withTiming(15, { duration: 7000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        // 4. Shine Sweep
        shinePos.value = withRepeat(
            withSequence(
                withTiming(width, { duration: 1500, easing: Easing.out(Easing.ease) }),
                withTiming(-width, { duration: 0 }),
                withDelay(5500, withTiming(-width, { duration: 0 }))
            ),
            -1,
            false
        );
    }, []);

    const animatedWiggleStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${wiggle.value}deg` }],
    }));

    const animatedDriftStyle1 = useAnimatedStyle(() => ({
        transform: [{ translateX: driftX.value }, { translateY: driftY.value }],
    }));

    const animatedDriftStyle2 = useAnimatedStyle(() => ({
        transform: [{ translateX: -driftX.value }, { translateY: -driftY.value }],
    }));

    const animatedShineStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shinePos.value }, { skewX: '-20deg' }],
    }));

    if (!data || data.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <LinearGradient
                        colors={['#f472b6', '#a855f7']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.fireIconBg}
                    >
                        <Animated.View style={animatedWiggleStyle}>
                            <Ionicons name="flame" size={14} color="white" />
                        </Animated.View>
                    </LinearGradient>
                    <Text style={[styles.title, { color: theme.colors.text }]}>Profilini Öne Çıkaranlar</Text>
                </View>
            </View>

            <GlassCard intensity={themeMode === 'dark' ? 40 : 25} style={styles.card}>
                {/* Background Ornaments - "Living UI" */}
                <View style={styles.ornamentContainer} pointerEvents="none">
                    <Animated.View style={[styles.ornament, { backgroundColor: '#ec4899', top: -30, left: -30, opacity: 0.15 }, animatedDriftStyle1]} />
                    <Animated.View style={[styles.ornament, { backgroundColor: '#8b5cf6', bottom: -30, right: -40, opacity: 0.15 }, animatedDriftStyle2]} />
                </View>

                {/* Shine Sweep Overlay */}
                <AnimatedGradient
                    colors={['transparent', 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.0)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, styles.shineSweep, animatedShineStyle]}
                    pointerEvents="none"
                />

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {data.map((profile, index) => (
                        <ProfileItem
                            key={profile.id || index}
                            profile={profile}
                            index={index}
                            onPress={onProfilePress}
                            theme={theme}
                            sharedPulse={sharedPulse}
                            sharedRotation={sharedRotation}
                        />
                    ))}
                </ScrollView>
            </GlassCard>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 0,
        marginBottom: 15,
        paddingHorizontal: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    fireIconBg: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    title: {
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    card: {
        borderRadius: 24,
        paddingVertical: 18,
        overflow: 'hidden', // Standard required for ornament clipping
    },
    ornamentContainer: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    ornament: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'red', // Overridden by inline
    },
    shineSweep: {
        width: width * 0.4,
        zIndex: 5,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 5,
        gap: 15,
    },
    profileItem: {
        alignItems: 'center',
        width: 70,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 8,
    },
    glowBorder: {
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderRadius: 31,
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 29,
        padding: 1,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 29,
    },
    onlineBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#0f172a',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        zIndex: 5,
    },
    onlineInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10b981',
    },
    boostBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#f472b6',
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'white',
        shadowColor: '#f472b6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 5,
        elevation: 5,
        zIndex: 10,
    },
    profileName: {
        fontSize: 11,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 0.2,
        opacity: 0.9,
    }
});
