import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';

export default function SkeletonCard() {
    const { theme } = useTheme();
    const pulseValue = useSharedValue(0.4);

    useEffect(() => {
        pulseValue.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 800 }),
                withTiming(0.4, { duration: 800 })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: pulseValue.value,
    }));

    return (
        <Animated.View style={[{
            borderRadius: 24, padding: 16, marginBottom: 12, marginHorizontal: 16,
            backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder, borderWidth: 1
        }, animatedStyle]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                <View style={{ marginLeft: 16, flex: 1, gap: 10 }}>
                    <View style={{ width: '50%', height: 18, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                    <View style={{ width: '35%', height: 14, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.05)' }} />
                </View>
            </View>
        </Animated.View>
    );
}
