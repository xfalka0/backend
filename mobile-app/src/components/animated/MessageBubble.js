import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withSpring,
} from 'react-native-reanimated';

const MessageBubble = ({ children, isMine, index }) => {
    const translateX = useSharedValue(isMine ? 50 : -50);
    const opacity = useSharedValue(0);

    useEffect(() => {
        opacity.value = withDelay(index * 50, withTiming(1, { duration: 400 }));
        translateX.value = withDelay(
            index * 50,
            withSpring(0, { damping: 12, stiffness: 100 })
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateX: translateX.value }],
    }));

    return (
        <Animated.View
            style={[
                styles.bubble,
                isMine ? styles.mine : styles.theirs,
                animatedStyle,
            ]}
        >
            {children}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    bubble: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        marginVertical: 4,
        maxWidth: '80%',
    },
    mine: {
        alignSelf: 'flex-end',
        backgroundColor: '#8B5CF6',
        borderBottomRightRadius: 4,
    },
    theirs: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
});

export default MessageBubble;
