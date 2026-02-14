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
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 18,
        alignSelf: 'flex-start',
        marginLeft: 16,
        marginBottom: 8,
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#fff',
        opacity: 0.6,
        marginHorizontal: 1,
    },
});

export default TypingIndicator;
