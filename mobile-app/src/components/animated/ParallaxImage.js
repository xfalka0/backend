import React from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useAnimatedStyle,
    interpolate,
    Extrapolate,
} from 'react-native-reanimated';

const { height } = Dimensions.get('window');

const ParallaxImage = ({ source, scrollY, index }) => {
    const animatedStyle = useAnimatedStyle(() => {
        const inputRange = [
            (index - 1) * height,
            index * height,
            (index + 1) * height,
        ];

        const translateY = interpolate(
            scrollY.value,
            inputRange,
            [-50, 0, 50],
            Extrapolate.CLAMP
        );

        return {
            transform: [{ translateY }],
        };
    });

    return (
        <Animated.Image
            source={source}
            style={[styles.image, animatedStyle]}
            resizeMode="cover"
        />
    );
};

const styles = StyleSheet.create({
    image: {
        width: '100%',
        height: 300,
    },
});

export default ParallaxImage;
