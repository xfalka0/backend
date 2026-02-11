import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, Vibration } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withSequence,
    withDelay,
    Easing,
    runOnJS
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

const ROSE_LOTTIE = require('../../assets/lottie/vip_confetti.json');
const CAR_LOTTIE = require('../../assets/lottie/fire_breath.json');

export default function GiftOverlay({ gift, receiver, onFinish }) {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const textOpacity = useSharedValue(0);
    const shakeTranslation = useSharedValue(0);

    useEffect(() => {
        if (gift) {
            // Entry Animation
            opacity.value = withTiming(1, { duration: 500 });
            scale.value = withSpring(1.2, { damping: 10, stiffness: 100 });

            // Text Entry
            textOpacity.value = withDelay(500, withTiming(1, { duration: 500 }));

            // Haptics & Shake
            if (gift.price >= 2000) {
                Vibration.vibrate([0, 100, 50, 200]); // Strong haptic pattern
                shakeTranslation.value = withDelay(800, withSequence(
                    withTiming(-10, { duration: 50 }),
                    withTiming(10, { duration: 50 }),
                    withTiming(-10, { duration: 50 }),
                    withTiming(10, { duration: 50 }),
                    withTiming(0, { duration: 50 })
                ));
            }

            // Auto Finish
            const timer = setTimeout(() => {
                opacity.value = withTiming(0, { duration: 500 }, () => {
                    runOnJS(onFinish)();
                });
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [gift]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { translateX: shakeTranslation.value }
        ],
        opacity: opacity.value
    }));

    const textStyle = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
        transform: [{ translateY: withSpring(textOpacity.value === 1 ? 0 : 20) }]
    }));

    if (!gift) return null;

    // Local assets fallback or remote
    const lottieFile = gift.price >= 2000 ? CAR_LOTTIE : ROSE_LOTTIE;

    return (
        <Animated.View style={[styles.container, { opacity: opacity.value }]}>
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />

            <View style={styles.content}>
                {/* Lottie Animation (Higher Layer) */}
                <LottieView
                    source={lottieFile}
                    autoPlay
                    loop={gift.price >= 2000}
                    style={gift.price >= 2000 ? styles.fullLottie : styles.centerLottie}
                />

                {/* Receiver Avatar */}
                <Animated.View style={[styles.avatarContainer, animatedStyle]}>
                    <Image
                        source={{ uri: receiver.avatar_url || 'https://via.placeholder.com/150' }}
                        style={styles.avatar}
                    />
                    <View style={styles.giftAura}>
                        <Text style={styles.giftEmoji}>{gift.icon}</Text>
                    </View>
                </Animated.View>

                {/* Text Info */}
                <Animated.View style={[styles.textContainer, textStyle]}>
                    <Text style={styles.receiverName}>{receiver.display_name || receiver.username}</Text>
                    <Text style={styles.subText}>Hediye Gönderildi!</Text>
                    <View style={styles.giftBadge}>
                        <Text style={styles.giftName}>{gift.name.toUpperCase()}</Text>
                    </View>
                </Animated.View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullLottie: {
        ...StyleSheet.absoluteFillObject,
        width: width,
        height: height,
    },
    centerLottie: {
        width: 300,
        height: 300,
        position: 'absolute',
        zIndex: 10,
    },
    avatarContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: '#fbbf24',
    },
    giftAura: {
        position: 'absolute',
        bottom: -10,
        backgroundColor: '#1e293b',
        padding: 8,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#fbbf24',
        elevation: 10,
        shadowColor: '#fbbf24',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    giftEmoji: {
        fontSize: 24,
    },
    textContainer: {
        marginTop: 40,
        alignItems: 'center',
    },
    receiverName: {
        color: 'white',
        fontSize: 24,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 2,
        textShadowColor: 'rgba(0,0,0,0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    },
    subText: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 4,
    },
    giftBadge: {
        backgroundColor: '#fbbf24',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 15,
    },
    giftName: {
        color: '#1e2b3c',
        fontSize: 12,
        fontWeight: '900',
    }
});
