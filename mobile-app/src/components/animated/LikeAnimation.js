import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withSpring,
    withTiming,
    runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

const LikeAnimation = ({ onLike }) => {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const heartScale = useSharedValue(1);

    const triggerAnimation = () => {
        // Heart burst animation
        scale.value = withSequence(
            withSpring(1.5, { damping: 10 }),
            withTiming(0, { duration: 400 })
        );

        opacity.value = withSequence(
            withTiming(1, { duration: 100 }),
            withTiming(0, { duration: 400 })
        );

        // Small heart scale pulse
        heartScale.value = withSequence(
            withSpring(1.3, { damping: 8 }),
            withSpring(1)
        );

        if (onLike) {
            runOnJS(onLike)();
        }
    };

    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            runOnJS(triggerAnimation)();
        });

    const animatedHeartStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: heartScale.value }],
    }));

    return (
        <GestureDetector gesture={doubleTap}>
            <View style={styles.container}>
                <Animated.View style={[styles.heartBurst, animatedHeartStyle]}>
                    <Ionicons name="heart" size={120} color="#EC4899" />
                </Animated.View>

                {/* Particle effects would go here with Lottie */}
                <Animated.View style={animatedIconStyle}>
                    <Ionicons name="heart-outline" size={28} color="#EC4899" />
                </Animated.View>
            </View>
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    heartBurst: {
        position: 'absolute',
    },
});

export default LikeAnimation;
