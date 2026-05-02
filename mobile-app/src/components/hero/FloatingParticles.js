import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withDelay,
    withSequence,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';

import { PERFORMANCE } from '../../config';

const { width, height } = Dimensions.get('window');

const Particle = ({ delay = 0 }) => {
    const translateY = useSharedValue(0);
    const opacity = useSharedValue(0);
    const scale = useSharedValue(1);
    const randomX = Math.random() * width;
    const duration = 3000 + Math.random() * 4000;

    useEffect(() => {
        if (PERFORMANCE.reduceMotion) return;

        opacity.value = withDelay(delay, withRepeat(
            withSequence(
                withTiming(0.6, { duration: duration / 2 }),
                withTiming(0, { duration: duration / 2 })
            ),
            -1,
            false
        ));

        translateY.value = withDelay(delay, withRepeat(
            withTiming(-150, { duration: duration }),
            -1,
            false
        ));

        // Disable scale animation in simple mode to save CPU
        if (!PERFORMANCE.simpleAnimations) {
            scale.value = withDelay(delay, withRepeat(
                withSequence(
                    withTiming(1.5, { duration: duration / 2 }),
                    withTiming(0.8, { duration: duration / 2 })
                ),
                -1,
                true
            ));
        }
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: randomX },
            { translateY: translateY.value },
            { scale: scale.value }
        ],
        opacity: opacity.value
    }));

    return (
        <Animated.View style={[styles.particle, animatedStyle]} />
    );
};

const FloatingParticles = () => {
    if (PERFORMANCE.reduceMotion) return null;

    const count = PERFORMANCE.simpleAnimations ? PERFORMANCE.maxParticles : 12;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {[...Array(count)].map((_, i) => (
                <Particle key={i} delay={i * 500} />
            ))}
        </View>
    );
};


const styles = StyleSheet.create({
    particle: {
        position: 'absolute',
        bottom: -20,
        left: 0,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        shadowColor: 'white',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    }
});

export default FloatingParticles;
