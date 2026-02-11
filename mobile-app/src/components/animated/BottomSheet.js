import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, Dimensions, Pressable } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_TRANSLATE_Y = -SCREEN_HEIGHT + 100;

const BottomSheet = forwardRef(({ children }, ref) => {
    const translateY = useSharedValue(0);
    const context = useSharedValue({ y: 0 });
    const active = useSharedValue(false);

    const scrollTo = (destination) => {
        'worklet';
        active.value = destination !== 0;
        translateY.value = withSpring(destination, { damping: 15 });
    };

    useImperativeHandle(ref, () => ({
        open: () => scrollTo(-SCREEN_HEIGHT / 2.5),
        close: () => scrollTo(0),
    }));

    const gesture = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            translateY.value = event.translationY + context.value.y;
            translateY.value = Math.max(translateY.value, MAX_TRANSLATE_Y);
        })
        .onEnd(() => {
            if (translateY.value > -SCREEN_HEIGHT / 4) {
                scrollTo(0);
            } else if (translateY.value < -SCREEN_HEIGHT / 1.5) {
                scrollTo(MAX_TRANSLATE_Y);
            } else {
                scrollTo(-SCREEN_HEIGHT / 2);
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: withTiming(active.value ? 1 : 0),
        pointerEvents: active.value ? 'auto' : 'none',
    }));

    return (
        <>
            <Animated.View style={[styles.backdrop, backdropStyle]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => scrollTo(0)} />
            </Animated.View>
            <GestureDetector gesture={gesture}>
                <Animated.View style={[styles.container, animatedStyle]}>
                    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
                        <View style={styles.handle} />
                        {children}
                    </BlurView>
                </Animated.View>
            </GestureDetector>
        </>
    );
});

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 99,
    },
    container: {
        height: SCREEN_HEIGHT,
        width: '100%',
        position: 'absolute',
        top: SCREEN_HEIGHT,
        borderRadius: 25,
        zIndex: 100,
        overflow: 'hidden',
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignSelf: 'center',
        marginVertical: 12,
        borderRadius: 2,
    },
});

export default BottomSheet;
