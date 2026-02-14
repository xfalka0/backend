import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';

const Dot = ({ index }) => {
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const startAnimation = () => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(translateY, {
                        toValue: -6,
                        duration: 400,
                        useNativeDriver: true,
                        easing: Easing.ease,
                        delay: index * 200,
                    }),
                    Animated.timing(translateY, {
                        toValue: 0,
                        duration: 400,
                        useNativeDriver: true,
                        easing: Easing.ease,
                    }),
                ])
            ).start();
        };

        startAnimation();
    }, [index]);

    return (
        <Animated.View style={[styles.dot, { transform: [{ translateY }] }]} />
    );
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
        marginHorizontal: 2,
    },
});

export default TypingIndicator;
