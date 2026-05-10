import React, { useEffect, useMemo } from 'react';
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
    runOnJS,
    Easing
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const CONFETTI_LOTTIE = require('../../assets/lottie/vip_confetti.json');

// Particles Component for the "Wow" effect
const Particle = ({ delay, index }) => {
    const y = useSharedValue(0);
    const x = useSharedValue(0);
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0);

    useEffect(() => {
        const angle = (index * 45) * (Math.PI / 180);
        const radius = 120 + Math.random() * 60;
        
        opacity.value = withSequence(
            withDelay(delay, withTiming(1, { duration: 200 })),
            withTiming(0, { duration: 1000 })
        );
        
        scale.value = withSequence(
            withDelay(delay, withTiming(Math.random() * 0.8 + 0.4, { duration: 300 })),
            withTiming(0, { duration: 1000 })
        );

        x.value = withDelay(delay, withSpring(Math.cos(angle) * radius, { damping: 10 }));
        y.value = withDelay(delay, withSpring(Math.sin(angle) * radius, { damping: 10 }));
    }, []);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { translateX: x.value },
            { translateY: y.value },
            { scale: scale.value }
        ]
    }));

    return (
        <Animated.View style={[styles.particle, style]}>
            <LinearGradient
                colors={['#fbbf24', '#f59e0b']}
                style={StyleSheet.absoluteFill}
            />
        </Animated.View>
    );
};

export default function GiftOverlay({ gift, receiver, onFinish }) {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const contentOpacity = useSharedValue(0);
    const logoPulse = useSharedValue(1);
    const rotateY = useSharedValue(0);
    const textY = useSharedValue(50);
    const glowScale = useSharedValue(1);

    useEffect(() => {
        if (gift) {
            // Screen Entry
            opacity.value = withTiming(1, { duration: 400 });

            // Content Entry
            contentOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
            scale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 100 }));
            textY.value = withDelay(400, withSpring(0, { damping: 15 }));

            // 3D Rotation Effect
            rotateY.value = withDelay(300, withRepeat(withTiming(Math.PI * 2, { duration: 4000, easing: Easing.linear }), -1));

            // Subtle Logo Pulse & Glow
            logoPulse.value = withDelay(800, withRepeat(withTiming(1.08, { duration: 1200 }), -1, true));
            glowScale.value = withRepeat(withTiming(1.2, { duration: 2000 }), -1, true);

            // Haptic Feedback
            Vibration.vibrate(100);

            // Auto Close
            const timer = setTimeout(() => {
                opacity.value = withTiming(0, { duration: 500 }, () => {
                    runOnJS(onFinish)();
                });
            }, 4000);

            return () => clearTimeout(timer);
        }
    }, [gift]);

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    const logoStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
        transform: [
            { scale: scale.value * logoPulse.value },
            { rotateY: `${rotateY.value}rad` }
        ]
    }));

    const glowStyle = useAnimatedStyle(() => ({
        transform: [{ scale: glowScale.value }],
        opacity: interpolate(glowScale.value, [1, 1.2], [0.3, 0.1])
    }));

    const textStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
        transform: [{ translateY: textY.value }]
    }));

    const particles = useMemo(() => 
        Array.from({ length: 12 }).map((_, i) => (
            <Particle key={i} index={i} delay={400 + (i * 50)} />
        )),
    []);

    if (!gift) return null;

    return (
        <Animated.View style={[styles.container, backdropStyle]} pointerEvents="box-none">
            <View style={styles.backdrop} />

            <View style={styles.content}>
                <LottieView
                    source={CONFETTI_LOTTIE}
                    autoPlay
                    loop
                    style={styles.fullLottie}
                    resizeMode="cover"
                />

                <View style={styles.centerStage}>
                    {particles}
                    <Animated.View style={[styles.glowRing, glowStyle]} />
                    
                    <Animated.View style={[styles.logoContainer, logoStyle]}>
                        <View style={styles.glow} />
                        <Image
                            source={gift.image || require('../../assets/gift_icon.webp')}
                            style={styles.mainLogo}
                            resizeMode="contain"
                        />
                    </Animated.View>

                    <Animated.View style={[styles.receiverBadge, textStyle]}>
                        <Text style={styles.receiverText}>{(receiver.display_name || receiver.username).toUpperCase()}</Text>
                    </Animated.View>
                </View>

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
        backgroundColor: 'rgba(11, 15, 25, 0.94)',
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
    centerStage: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 300,
        height: 300,
        zIndex: 10,
    },
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        perspective: 1000,
    },
    glow: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        shadowColor: '#fbbf24',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 40,
        elevation: 10,
    },
    glowRing: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 140,
        borderWidth: 2,
        borderColor: 'rgba(251, 191, 36, 0.3)',
    },
    particle: {
        position: 'absolute',
        width: 6,
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    mainLogo: {
        width: 160,
        height: 160,
    },
    receiverBadge: {
        backgroundColor: '#1e293b',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        borderWidth: 1.5,
        borderColor: '#fbbf24',
        marginTop: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    receiverText: {
        color: '#fbbf24',
        fontWeight: '950',
        fontSize: 16,
        letterSpacing: 1,
        textAlign: 'center',
    },
    textWrapper: {
        marginTop: 60,
        alignItems: 'center',
        zIndex: 10,
    },
    headerText: {
        color: 'white',
        fontSize: 32,
        fontWeight: '950',
        letterSpacing: 1,
        textShadowColor: 'rgba(251, 191, 36, 0.6)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 20,
    },
    giftBadge: {
        marginTop: 15,
        paddingHorizontal: 25,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(251, 191, 36, 0.5)',
    },
    giftName: {
        color: '#fbbf24',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 2,
    }
});
