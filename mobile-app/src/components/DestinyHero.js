import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, Platform, Image } from 'react-native';
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

import { PERFORMANCE } from '../config';

const { width } = Dimensions.get('window');

const DestinyHero = ({ onPress }) => {
    // Animation Values
    const scale = useSharedValue(1);
    const pulseGlow = useSharedValue(1);
    const rotate = useSharedValue(0);
    const float = useSharedValue(0);

    useEffect(() => {
        if (PERFORMANCE.reduceMotion) return;

        // Simplified Breathing Animation - only if not in simple mode
        if (!PERFORMANCE.simpleAnimations) {
            scale.value = withRepeat(
                withSequence(
                    withTiming(1.01, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );

            // Slow Rotation for the ring - only in high performance mode
            rotate.value = withRepeat(
                withTiming(360, { duration: 30000, easing: Easing.linear }),
                -1,
                false
            );
        }

        // Continuous Pulse Animation (Glow) - Subtler
        pulseGlow.value = withRepeat(
            withSequence(
                withTiming(1.15, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        // Floating Animation for the Icon - Slower
        float.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) })
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
                {/* Main Card Container */}
                <View style={styles.card}>
                    <Image 
                        source={{ uri: 'https://images.pexels.com/photos/1024960/pexels-photo-1024960.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1' }} 
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                    />
                    <LinearGradient
                        colors={['rgba(236, 72, 153, 0.8)', 'rgba(225, 29, 72, 0.9)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />

                    {/* Content */}
                    <View style={styles.content}>
                        <Animated.View style={[styles.centerIconContainer, animatedFloatStyle]}>
                            <LinearGradient
                                colors={['#ec4899', '#8b5cf6']}
                                style={styles.iconGradient}
                            >
                                <Ionicons name="infinite" size={20} color="white" />
                            </LinearGradient>
                        </Animated.View>

                        <View style={styles.textColumn}>
                            <Text style={styles.mainText} adjustsFontSizeToFit numberOfLines={1}>
                                Kaderindeki kişiyi keşfet
                            </Text>
                            <View style={styles.bottomBadge}>
                                <Text style={styles.bottomText} adjustsFontSizeToFit numberOfLines={1}>Dokun ve eşleşmeni başlat</Text>
                                <Ionicons name="sparkles" size={10} color="#ec4899" style={{ marginLeft: 4 }} />
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', right: 0 }} />
                    </View>
                </View>
            </Animated.View>
        </Pressable>
    );

};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 75,
        alignSelf: 'center',
        marginVertical: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        width: '100%',
        height: '100%',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        elevation: Platform.OS === 'android' ? 0 : 15,
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        justifyContent: 'center',
    },
    circleOverlayRight: {
        position: 'absolute',
        right: -30,
        top: -20,
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        zIndex: 0,
    },
    circleOverlaySmall: {
        position: 'absolute',
        right: 60,
        bottom: -30,
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        zIndex: 0,
    },
    glassOverlay: {
        position: 'absolute',
        left: -15,
        top: -40,
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        zIndex: 0,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 10,
        flex: 1,
    },
    centerIconContainer: {
        marginRight: 12,
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
        elevation: Platform.OS === 'android' ? 0 : 12,
    },
    iconGradient: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.8)',
    },
    textColumn: {
        flex: 1,
        justifyContent: 'center',
    },
    mainText: {
        color: 'white',
        fontSize: 15,
        fontWeight: '900',
        marginBottom: 2,
        letterSpacing: -0.2,
    },
    bottomBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-start',
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    bottomText: {
        color: 'white',
        fontSize: 9,
        fontWeight: '700',
    }
});

export default DestinyHero;
