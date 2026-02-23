import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, Vibration } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withSequence,
    withDelay,
    withRepeat,
    interpolate,
    runOnJS
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';

const { width, height } = Dimensions.get('window');

const CONFETTI_LOTTIE = require('../../assets/lottie/vip_confetti.json');

export default function GiftOverlay({ gift, receiver, onFinish }) {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const contentOpacity = useSharedValue(0);
    const logoPulse = useSharedValue(1);
    const textY = useSharedValue(50);

    useEffect(() => {
        if (gift) {
            // Screen Entry
            opacity.value = withTiming(1, { duration: 400 });

            // Content Entry
            contentOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
            scale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 100 }));
            textY.value = withDelay(400, withSpring(0, { damping: 15 }));

            // Subtle Logo Pulse
            logoPulse.value = withDelay(800, withRepeat(withTiming(1.08, { duration: 1200 }), -1, true));

            // Haptic Feedback
            Vibration.vibrate(100);

            // Auto Close
            const timer = setTimeout(() => {
                opacity.value = withTiming(0, { duration: 500 }, () => {
                    runOnJS(onFinish)();
                });
            }, 3500);

            return () => clearTimeout(timer);
        }
    }, [gift]);

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    const logoStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
        transform: [
            { scale: scale.value * logoPulse.value }
        ]
    }));

    const textStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
        transform: [{ translateY: textY.value }]
    }));

    if (!gift) return null;

    return (
        <Animated.View style={[styles.container, backdropStyle]} pointerEvents="box-none">
            {/* High-Impact Solid Backdrop */}
            <View style={styles.backdrop} />

            <View style={styles.content}>
                {/* Celebration Layer - Base Confetti */}
                <LottieView
                    source={CONFETTI_LOTTIE}
                    autoPlay
                    loop
                    style={styles.fullLottie}
                    resizeMode="cover"
                />

                <Animated.View style={[styles.logoContainer, logoStyle]}>
                    <View style={styles.glow} />
                    <Image
                        source={gift.image || require('../../assets/gift_icon.webp')}
                        style={styles.mainLogo}
                        resizeMode="contain"
                    />

                    <View style={styles.receiverBadge}>
                        <Text style={styles.receiverText}>{(receiver.display_name || receiver.username).toUpperCase()}</Text>
                    </View>
                </Animated.View>

                <Animated.View style={[styles.textWrapper, textStyle]}>
                    <Text style={styles.headerText}>HEDİYE GÖNDERİLDİ!</Text>
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
        zIndex: 99999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(11, 15, 25, 0.96)', // Solid deep dark
    },
    content: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullLottie: {
        ...StyleSheet.absoluteFillObject,
        width: width,
        height: height,
        zIndex: 1,
    },
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    glow: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: 'rgba(251, 191, 36, 0.25)',
        shadowColor: '#fbbf24',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 50,
        elevation: 10,
    },
    glowEpic: {
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(251, 191, 36, 0.4)',
        shadowRadius: 80,
    },
    mainLogo: {
        width: 180,
        height: 180,
    },
    receiverBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1e293b',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 25,
        borderWidth: 1.5,
        borderColor: '#fbbf24',
        marginTop: -30,
        elevation: 5,
        minWidth: 120,
    },
    receiverText: {
        color: '#fbbf24',
        fontWeight: '950',
        fontSize: 15,
        letterSpacing: 1,
        textAlign: 'center',
    },
    textWrapper: {
        marginTop: 50,
        alignItems: 'center',
        zIndex: 10,
    },
    headerText: {
        color: 'white',
        fontSize: 32,
        fontWeight: '950',
        letterSpacing: 1,
        textShadowColor: 'rgba(251, 191, 36, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 15,
    },
    giftBadge: {
        marginTop: 15,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 15,
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderWidth: 1,
        borderColor: '#fbbf24',
    },
    giftName: {
        color: '#fbbf24',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 2,
    }
});
