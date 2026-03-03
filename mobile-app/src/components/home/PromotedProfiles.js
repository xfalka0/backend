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
                        <AnimatedGradient
                            colors={['#FBBF24', '#D97706', '#FBBF24']}
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
                        {profile.is_online && (
                            <View style={styles.onlineBadge}>
                                <View style={styles.onlineInner} />
                            </View>
                        )}
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

    // Living Background Drift - Disabled for performance
    useEffect(() => {
        sharedPulse.value = 1;
        sharedRotation.value = 0;
        wiggle.value = 0;
        driftX.value = 0;
        driftY.value = 0;
        shinePos.value = -width;
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
                        colors={['#FBBF24', '#D97706']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.fireIconBg}
                    >
                        <Animated.View style={animatedWiggleStyle}>
                            <Ionicons name="sparkles" size={14} color="white" />
                        </Animated.View>
                    </LinearGradient>
                    <Text style={[styles.title, { color: theme.colors.text }]}>Profilini Öne Çıkaranlar</Text>
                </View>
            </View>

            <View style={styles.premiumCardContainer}>
                <LinearGradient
                    colors={themeMode === 'dark' ? ['#0f172a', '#1e293b', '#0f172a'] : ['#ffffff', '#f8fafc', '#ffffff']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                    colors={['rgba(251, 191, 36, 0.08)', 'transparent']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
                />
                <AnimatedGradient
                    colors={['transparent', 'rgba(251, 191, 36, 0.0)', 'rgba(251, 191, 36, 0.1)', 'rgba(251, 191, 36, 0.0)', 'transparent']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, styles.shineSweep, animatedShineStyle]}
                    pointerEvents="none"
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
            </View>
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
    premiumCardContainer: {
        borderRadius: 24,
        paddingVertical: 18,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(217, 119, 6, 0.4)', // Sharp Gold Border
        backgroundColor: '#0f172a',
        shadowColor: '#FBBF24',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    ornamentContainer: {
        display: 'none',
    },
    ornament: {
        display: 'none',
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
        backgroundColor: '#D97706',
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'white',
        shadowColor: '#FBBF24',
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
