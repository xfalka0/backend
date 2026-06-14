import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Text, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function GiftAnimationOverlay({ giftEvent }) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!giftEvent) return;

        // Reset
        scaleAnim.setValue(0);
        rotateAnim.setValue(0);
        opacityAnim.setValue(0);

        // Run animation
        Animated.sequence([
            // Fade in and pop scale
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1.8, friction: 6, tension: 80, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                Animated.timing(rotateAnim, { toValue: 1, duration: 800, useNativeDriver: true })
            ]),
            Animated.delay(1800),
            // Fade out
            Animated.parallel([
                Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 0.5, duration: 300, useNativeDriver: true })
            ])
        ]).start();
    }, [giftEvent]);

    if (!giftEvent) return null;

    const icon = giftEvent.giftIcon || '🎁';

    const rotateInterpolate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    return (
        <Animated.View style={[
            styles.overlay, 
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }, { rotate: rotateInterpolate }] }
        ]}>
            <Text style={styles.animatedIcon}>{icon}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: height / 2.8,
        left: width / 2 - 40,
        width: 80,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        pointerEvents: 'none',
    },
    animatedIcon: {
        fontSize: 55,
        textShadowColor: '#ff007f',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
});
