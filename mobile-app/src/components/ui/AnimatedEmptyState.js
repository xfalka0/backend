import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    withSpring,
    Easing,
    FadeInDown
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function AnimatedEmptyState({
    icon = 'file-tray-outline',
    title = 'Burada Henüz Hiçbir Şey Yok',
    description = 'Burası biraz fazla sessiz...',
    colors = ['#8b5cf6', '#ec4899']
}) {
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);

    useEffect(() => {
        // Continuous smooth floating and pulsing animation
        scale.value = withRepeat(
            withSequence(
                withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        rotation.value = withRepeat(
            withSequence(
                withTiming(3, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                withTiming(-3, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, []);

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { rotate: `${rotation.value}deg` }
        ]
    }));

    return (
        <Animated.View entering={FadeInDown.springify().damping(14)} style={styles.container}>
            <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
                <LinearGradient
                    colors={colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientCircle}
                >
                    <Ionicons name={icon} size={48} color="white" />
                </LinearGradient>
                {/* Glow Effect */}
                <LinearGradient
                    colors={colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.gradientCircle, styles.glow]}
                />
            </Animated.View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 20,
    },
    iconContainer: {
        position: 'relative',
        marginBottom: 24,
    },
    gradientCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    glow: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1,
        opacity: 0.4,
        transform: [{ scale: 1.2 }],
    },
    title: {
        fontSize: 20,
        fontWeight: '900',
        color: 'white',
        marginBottom: 8,
        textAlign: 'center',
    },
    description: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.6)',
        textAlign: 'center',
        maxWidth: '80%',
        lineHeight: 20,
    }
});
