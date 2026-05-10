import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const CONFETTI_COUNT = 40;
const COLORS = ['#f59e0b', '#ea580c', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981'];

const ConfettiPiece = ({ index }) => {
    const anim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const left = useRef(Math.random() * width).current;
    const color = useRef(COLORS[Math.floor(Math.random() * COLORS.length)]).current;
    const size = useRef(Math.random() * 8 + 6).current;
    const duration = useRef(Math.random() * 2000 + 2000).current;
    const delay = useRef(Math.random() * 1000).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(anim, {
                toValue: 1,
                duration: duration,
                delay: delay,
                useNativeDriver: true,
            }),
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: duration,
                delay: delay,
                useNativeDriver: true,
            })
        ]).start();
    }, []);

    const translateY = anim.interpolate({
        inputRange: [0, 1],
        outputRange: [-20, height + 50],
    });

    const translateX = anim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, Math.random() * 50 - 25, 0],
    });

    const rotate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', `${Math.random() * 360 + 360}deg`],
    });

    const opacity = anim.interpolate({
        inputRange: [0, 0.8, 1],
        outputRange: [1, 1, 0],
    });

    return (
        <Animated.View
            style={[
                styles.confetti,
                {
                    left,
                    backgroundColor: color,
                    width: size,
                    height: size,
                    opacity,
                    transform: [
                        { translateY },
                        { translateX },
                        { rotate },
                        { perspective: 1000 }
                    ],
                },
            ]}
        />
    );
};

export default function Confetti({ onFinish }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            if (onFinish) onFinish();
        }, 4000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={styles.container} pointerEvents="none">
            {[...Array(CONFETTI_COUNT)].map((_, i) => (
                <ConfettiPiece key={i} index={i} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10000,
    },
    confetti: {
        position: 'absolute',
        top: 0,
        borderRadius: 2,
    },
});
