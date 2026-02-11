import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withSpring,
} from 'react-native-reanimated';

const MessageBubble = ({ children, isMine, index, isRead }) => {
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
            {isMine && (
                <View style={styles.statusContainer}>
                    <Ionicons
                        name={isRead ? "checkmark-done" : "checkmark"}
                        size={12}
                        color={isRead ? "#3b82f6" : "rgba(255, 255, 255, 0.5)"}
                    />
                </View>
            )}
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
    statusContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 2,
        marginRight: -4,
        marginBottom: -4,
    },
});

export default MessageBubble;
