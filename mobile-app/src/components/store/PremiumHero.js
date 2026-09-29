import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { STORE_THEME } from '../../constants/storeTheme';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, useReducedMotion, cancelAnimation, FadeInUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const Particle = ({ delay, duration, startX, size, opacity }) => {
    const translateY = useSharedValue(50);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        if (!reduceMotion) {
            translateY.value = 50;
            const timeout = setTimeout(() => {
                translateY.value = withRepeat(
                    withTiming(-120, { duration, easing: Easing.linear }),
                    -1,
                    false
                );
            }, delay);
            return () => {
                clearTimeout(timeout);
                cancelAnimation(translateY);
            };
        }
    }, [reduceMotion, delay, duration]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }]
    }));

    if (reduceMotion) return null;

    return (
        <Animated.View style={[{ position: 'absolute', bottom: -20, left: startX, opacity }, animatedStyle]} pointerEvents="none">
            <Ionicons name="heart" size={size} color="#FF5C86" />
        </Animated.View>
    );
};

export default function PremiumHero() {
    const particles = useMemo(() => {
        return Array.from({ length: STORE_THEME.animations.particleCount }).map((_, i) => ({
            id: i,
            delay: Math.random() * 4000,
            duration: STORE_THEME.animations.particleMinDuration + Math.random() * (STORE_THEME.animations.particleMaxDuration - STORE_THEME.animations.particleMinDuration),
            startX: Math.random() * width,
            size: 10 + Math.random() * 8,
            opacity: 0.10 + Math.random() * 0.08
        }));
    }, []);

    return (
        <View style={styles.container}>
            <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
                {particles.map(p => <Particle key={p.id} {...p} />)}
            </View>
            <Animated.Text entering={FadeInUp.delay(0).duration(300)} style={styles.title}>Aşkı şansa bırakma</Animated.Text>
            <Animated.Text entering={FadeInUp.delay(STORE_THEME.animations.staggerDelay).duration(300)} style={styles.subtitle}>
                Premium ile seni beğenenleri gör, sınırsız beğen.
            </Animated.Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: STORE_THEME.spacing.paddingHorizontal,
        paddingTop: 4,
        paddingBottom: 8,
        position: 'relative',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: STORE_THEME.colors.textWhite,
        letterSpacing: -0.5,
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '400',
        color: STORE_THEME.colors.textMuted,
        lineHeight: 18,
    },
});
