
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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

    useEffect(() => {
        // Continuous Pulse Animation (Breathing)
        pulseGlow.value = withRepeat(
            withSequence(
                withTiming(1.2, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        // Slow Rotation for the ring
        // Slow Rotation for the ring
        rotate.value = withRepeat(
            withTiming(360, { duration: 20000, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    const handlePressIn = () => {
        scale.value = withSpring(0.95);
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
                <View style={styles.card}>
                    <LinearGradient
                        colors={['#2e1065', '#4c1d95', '#1e1b4b']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0.8, y: 1 }}
                        style={styles.cardGradient}
                    >
                        {/* Background Decorative Ring */}
                        <Animated.View style={[styles.ringContainer, animatedRingStyle]} pointerEvents="none">
                            <View style={styles.ring} />
                        </Animated.View>

                        {/* Content */}
                        <View style={styles.content}>
                            <View style={styles.centerIconContainer}>
                                <LinearGradient
                                    colors={['#ec4899', '#8b5cf6']}
                                    style={styles.iconGradient}
                                >
                                    <Ionicons name="infinite" size={29} color="white" />
                                </LinearGradient>
                            </View>

                            <Text style={styles.mainText}>
                                Kaderindeki kişiyi{'\n'}keşfet
                            </Text>

                            <View style={styles.bottomBadge}>
                                <Text style={styles.bottomText}>Dokun ve eşleşmeni başlat</Text>
                                <Ionicons name="sparkles" size={12} color="#ec4899" style={{ marginLeft: 6 }} />
                            </View>
                        </View>
                    </LinearGradient>
                </View>
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
        borderRadius: 25, // Adjusted
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        elevation: 15,
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    cardGradient: {
        flex: 1,
        padding: 15, // Reduced padding
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringContainer: {
        position: 'absolute',
        width: 400,
        height: 400,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.1,
    },
    ring: {
        width: 300,
        height: 300,
        borderRadius: 150,
        borderWidth: 40,
        borderColor: '#ec4899',
        borderStyle: 'dashed',
    },
    content: {
        alignItems: 'center',
        zIndex: 10,
        justifyContent: 'center', // Ensure centering
        flex: 1, // Take available space
    },
    topText: {
        color: 'rgba(236, 72, 153, 0.9)',
        fontSize: 10, // Smaller
        fontWeight: '900',
        letterSpacing: 3,
        marginBottom: 8, // Reduced margin
        textTransform: 'uppercase',
    },
    centerIconContainer: {
        marginBottom: 8, // Reduced margin
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 10,
    },
    iconGradient: {
        width: 48, // Smaller icon container
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    mainText: {
        color: 'white',
        fontSize: 20, // Smaller font
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 10, // Reduced margin
        lineHeight: 26, // Tighter line height
    },
    bottomBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6, // Smaller padding
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    bottomText: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 11, // Smaller font
        fontWeight: '600',
    }
});

export default DestinyHero;
