import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
    interpolate,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const Blob = ({ color, size, duration, delay }) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);

    useEffect(() => {
        translateX.value = withRepeat(
            withTiming(Math.random() * width - width / 2, {
                duration: duration,
                easing: Easing.inOut(Easing.sin),
            }),
            -1,
            true
        );
        translateY.value = withRepeat(
            withTiming(Math.random() * height - height / 2, {
                duration: duration * 1.2,
                easing: Easing.inOut(Easing.sin),
            }),
            -1,
            true
        );
        scale.value = withRepeat(
            withTiming(1.2, {
                duration: duration * 0.8,
                easing: Easing.inOut(Easing.sin),
            }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value }
        ],
    }));

    return (
        <Animated.View
            style={[
                styles.blob,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                    opacity: 0.25,
                },
                animatedStyle,
            ]}
        />
    );
};

export default function AuthBackground({ hideCircles = false }) {
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#030712', '#0f172a', '#1e1b4b']}
                style={StyleSheet.absoluteFill}
            />

            {!hideCircles && (
                <View style={styles.blobsContainer}>
                    <Blob color="#7928ca" size={400} duration={12000} />
                    <Blob color="#ff0080" size={350} duration={15000} />
                    <Blob color="#0070f3" size={300} duration={18000} />
                    <Blob color="#8b5cf6" size={250} duration={14000} />
                    <BlurView intensity={100} style={StyleSheet.absoluteFill} />
                </View>
            )}

            <View style={styles.overlay} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#030712',
    },
    blobsContainer: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.6,
    },
    blob: {
        position: 'absolute',
        top: '20%',
        left: '20%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(3, 7, 18, 0.3)',
    }
});
