import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    withDelay,
} from 'react-native-reanimated';

const Dot = ({ index }) => {
    const translateY = useSharedValue(0);

    useEffect(() => {
        translateY.value = withDelay(
            index * 200,
            withRepeat(
                withSequence(
                    withTiming(-6, { duration: 400 }),
                    withTiming(0, { duration: 400 })
                ),
                -1,
                true
            )
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    return <Animated.View style={[styles.dot, animatedStyle]} />;
};

const TypingIndicator = () => {
    return (
        <View style={styles.container}>
            <Dot index={0} />
            <Dot index={1} />
            <Dot index={2} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 20,
        alignSelf: 'flex-start',
        margin: 10,
        gap: 4,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
});

export default TypingIndicator;
