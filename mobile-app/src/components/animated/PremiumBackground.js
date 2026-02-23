import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    interpolate
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const AnimatedBlob = ({ color, size, duration, delay = 0, initialPosition }) => {
    const translateX = useSharedValue(initialPosition.x);
    const translateY = useSharedValue(initialPosition.y);
    const scale = useSharedValue(1);

    useEffect(() => {
        translateX.value = withRepeat(
            withSequence(
                withTiming(initialPosition.x + 30, { duration, easing: Easing.inOut(Easing.sin) }),
                withTiming(initialPosition.x - 30, { duration, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
        translateY.value = withRepeat(
            withSequence(
                withTiming(initialPosition.y - 40, { duration: duration * 1.2, easing: Easing.inOut(Easing.sin) }),
                withTiming(initialPosition.y + 40, { duration: duration * 1.2, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
        scale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: duration * 0.8 }),
                withTiming(0.9, { duration: duration * 0.8 })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value }
        ]
    }));

    return (
        <Animated.View
            style={[
                styles.blob,
                {
                    backgroundColor: color,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    top: height / 2,
                    left: width / 2,
                },
                animatedStyle
            ]}
        />
    );
};

const PremiumBackground = React.memo(() => {
    return (
        <View style={styles.container} pointerEvents="none">
            {/* 1. Base Gradient Layer */}
            <LinearGradient
                colors={['#0B0F2A', '#0F1435', '#0A0D22']}
                locations={[0, 0.4, 1]}
                style={StyleSheet.absoluteFill}
            />

            {/* 2. Ambient Glow Layers */}
            <View style={styles.glowContainer}>
                {/* Gold Glow Top-Left */}
                <View style={[styles.glowBase, styles.goldGlow]} />
                {/* Purple Glow Middle-Right */}
                <View style={[styles.glowBase, styles.purpleGlow]} />
            </View>

            {/* 3. Floating Blur Blobs */}
            <View style={StyleSheet.absoluteFill}>
                <AnimatedBlob
                    color="rgba(138, 43, 226, 0.08)"
                    size={width * 0.8}
                    duration={15000}
                    initialPosition={{ x: width * 0.1, y: -height * 0.2 }}
                />
                <AnimatedBlob
                    color="rgba(255, 215, 0, 0.05)"
                    size={width * 0.6}
                    duration={18000}
                    initialPosition={{ x: -width * 0.3, y: height * 0.1 }}
                />
            </View>

            {/* 4. Glass/Blur Overlay to soften everything */}
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

            {/* 5. Subtle Noise Texture Overlay */}
            {/* Note: In a real app, we'd use a small tiled noise PNG. 
                Using a semi-transparent black overlay with very low opacity to simulate depth if image is missing,
                but I will attempt to use a standard noise representation if possible or just style it. */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.02)', opacity: 0.3 }]} />
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0B0F2A',
    },
    glowContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    glowBase: {
        position: 'absolute',
        width: width * 1.5,
        height: width * 1.5,
        borderRadius: width * 0.75,
        opacity: 0.4,
    },
    goldGlow: {
        top: -width * 0.5,
        left: -width * 0.5,
        backgroundColor: 'rgba(255, 215, 0, 0.06)',
    },
    purpleGlow: {
        bottom: -width * 0.2,
        right: -width * 0.5,
        backgroundColor: 'rgba(138, 43, 226, 0.08)',
    },
    blob: {
        position: 'absolute',
        opacity: 0.07,
    }
});

export default PremiumBackground;
