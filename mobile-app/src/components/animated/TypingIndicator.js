import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import GlassCard from '../ui/GlassCard';

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
        <View style={{ marginLeft: 16, marginBottom: 8, alignSelf: 'flex-start' }}>
            <GlassCard intensity={30} tint="dark" style={styles.container}>
                <Dot index={0} />
                <Dot index={1} />
                <Dot index={2} />
            </GlassCard>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 20,
        gap: 6,
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
