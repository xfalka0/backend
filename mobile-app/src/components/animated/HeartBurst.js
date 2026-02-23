import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    Easing,
    withSequence
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const HeartParticle = ({ index, color }) => {
    const translateY = useSharedValue(0);
    const translateX = useSharedValue(0);
    const opacity = useSharedValue(1);
    const scale = useSharedValue(0);

    // Randomize angle and distance for a "burst" effect
    const angle = (Math.PI * 2 * index) / 6 + (Math.random() - 0.5); // 6 particles roughly in a circle
    const distance = 40 + Math.random() * 30; // 40 to 70 distance

    useEffect(() => {
        const destX = Math.cos(angle) * distance;
        const destY = Math.sin(angle) * distance;

        scale.value = withSequence(
            withTiming(1, { duration: 200 }),
            withDelay(200, withTiming(0, { duration: 300 }))
        );

        translateX.value = withTiming(destX, { duration: 600 });
        translateY.value = withTiming(destY - 20, { duration: 600 });

        opacity.value = withDelay(300, withTiming(0, { duration: 300 }));
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { scale: scale.value }
            ],
            position: 'absolute',
            left: 0,
            top: 0,
        };
    });

    return (
        <Animated.View style={animatedStyle}>
            <Ionicons name="heart" size={12 + Math.random() * 8} color={color || "#ff5e95"} />
        </Animated.View>
    );
};

export default function HeartBurst({ count = 6, color = "#ff5e95" }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <HeartParticle key={i} index={i} color={color} />
            ))}
        </>
    );
}
