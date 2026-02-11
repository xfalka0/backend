import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

const SafeLottie = ({ source, style, loop = true, autoPlay = true, fallback = null }) => {
    const [error, setError] = useState(false);

    if (error || !source) {
        return fallback ? <View style={style}>{fallback}</View> : null;
    }

    return (
        <Animated.View entering={FadeIn} style={style}>
            <LottieView
                source={source}
                autoPlay={autoPlay}
                loop={loop}
                style={StyleSheet.absoluteFill}
                onError={(e) => {
                    console.log('Lottie Load Error:', e);
                    setError(true);
                }}
            />
        </Animated.View>
    );
};

export default SafeLottie;
