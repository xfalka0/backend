import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from './ui/GlassCard';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    withSpring,
    Easing,
    interpolate,
    Extrapolation
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const DestinyHero = ({ onPress }) => {
    // Animation Values
    const scale = useSharedValue(1);
    const pulseGlow = useSharedValue(1);
    const rotate = useSharedValue(0);
    const float = useSharedValue(0);

    useEffect(() => {
        // Continuous Breathing Animation for the whole card
        scale.value = withRepeat(
            withSequence(
                withTiming(1.02, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        // Continuous Pulse Animation (Glow)
        pulseGlow.value = withRepeat(
            withSequence(
                withTiming(1.3, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
        // ... existing slow rotation and float code ...
        // Slow Rotation for the ring
        rotate.value = withRepeat(
            withTiming(360, { duration: 20000, easing: Easing.linear }),
            -1,
            false
        );

        // Floating Animation for the Icon
        float.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, []);

    const handlePressIn = () => {
        scale.value = withTiming(0.92, { duration: 150 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    const animatedContainerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    const animatedGlowStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseGlow.value }],
        opacity: interpolate(pulseGlow.value, [1, 1.2], [0.3, 0.1], Extrapolation.CLAMP)
    }));

    const animatedRingStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotate.value}deg` }]
    }));

    const animatedFloatStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: interpolate(float.value, [0, 1], [0, -8]) }]
    }));

    return (
        <Pressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={{ alignItems: 'center', justifyContent: 'center' }}
        >
            <Animated.View style={[styles.container, animatedContainerStyle]}>
                {/* Outer Glow / Pulse Layer */}
                <Animated.View style={[styles.glowLayer, animatedGlowStyle]} pointerEvents="none">
                    <LinearGradient
                        colors={['#ec4899', '#8b5cf6', '#3b82f6']}
                        style={styles.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                </Animated.View>

                {/* Main Card */}
                <GlassCard style={styles.card} intensity={60} tint="dark">
                    <LinearGradient
                        colors={['rgba(46, 16, 101, 0.8)', 'rgba(30, 27, 75, 0.8)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0.8, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />

                    {/* Background Decorative Ring */}
                    <Animated.View style={[styles.ringContainer, animatedRingStyle]} pointerEvents="none">
                        <View style={styles.ring} />
                    </Animated.View>

                    {/* Content */}
                    <View style={styles.content}>
                        <Animated.View style={[styles.centerIconContainer, animatedFloatStyle]}>
                            <LinearGradient
                                colors={['#ec4899', '#8b5cf6']}
                                style={styles.iconGradient}
                            >
                                <Ionicons name="infinite" size={29} color="white" />
                            </LinearGradient>
                        </Animated.View>

                        <Text style={styles.mainText} adjustsFontSizeToFit numberOfLines={2}>
                            Kaderindeki kişiyi{'\n'}keşfet
                        </Text>

                        <View style={styles.bottomBadge}>
                            <Text style={styles.bottomText} adjustsFontSizeToFit numberOfLines={1}>Dokun ve eşleşmeni başlat</Text>
                            <Ionicons name="sparkles" size={12} color="#ec4899" style={{ marginLeft: 6 }} />
                        </View>
                    </View>
                </GlassCard>
            </Animated.View>
        </Pressable>
    );

};

const styles = StyleSheet.create({
    container: {
        width: width * 0.9,
        maxWidth: 400,
        height: 170, // Reduced from 220
        alignSelf: 'center',
        marginVertical: 7, // Reduced from 20
        justifyContent: 'center',
        alignItems: 'center',
    },
    glowLayer: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 10, // Adjusted
        opacity: 0.4,
        transform: [{ scale: 1.03 }], // Slightly smaller scale
    },
    gradient: {
        flex: 1,
        borderRadius: 25,
    },
    card: {
        width: '100%',
        height: '100%',
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        elevation: 15,
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringContainer: {
        position: 'absolute',
        width: 400,
        height: 400,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.15,
    },
    ring: {
        width: 320,
        height: 320,
        borderRadius: 160,
        borderWidth: 50,
        borderColor: '#ec4899',
        borderStyle: 'dashed',
    },
    content: {
        alignItems: 'center',
        zIndex: 10,
        justifyContent: 'center',
        flex: 1,
    },
    centerIconContainer: {
        marginBottom: 12,
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 25,
        elevation: 12,
    },
    iconGradient: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.8)',
    },
    mainText: {
        color: 'white',
        fontSize: 20, // Reduced from 24
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 10, // Reduced from 14
        lineHeight: 26, // Reduced from 30
        letterSpacing: -0.5,
    },
    bottomBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    bottomText: {
        color: 'white',
        fontSize: 11, // Reduced from 13
        fontWeight: '800',
    }
});

export default DestinyHero;
