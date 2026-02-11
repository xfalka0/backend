import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolate,
    Extrapolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';

const { width } = Dimensions.get('window');

const AnimatedPostCard = ({ children, index, scrollY }) => {
    const { theme, themeMode } = useTheme();
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.9);

    useEffect(() => {
        // Staggered entrance animation
        opacity.value = withTiming(1, { duration: 400 });
        scale.value = withSpring(1, {
            damping: 15,
            stiffness: 100,
        });
    }, []);

    // Scroll-based animation - DISABLED AS REQUESTED
    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
            transform: [{ scale: scale.value }],
        };
    });

    return (
        <Animated.View style={[
            styles.card,
            animatedStyle,
            {
                backgroundColor: themeMode === 'dark' ? 'rgba(30, 41, 59, 0.5)' : theme.colors.card,
                shadowOpacity: themeMode === 'dark' ? 0.4 : 0.1
            }
        ]}>
            <View style={[styles.content, { borderColor: theme.colors.glassBorder }]}>
                {children}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    card: {
        width: width - 32,
        marginHorizontal: 16,
        marginVertical: 12,
        borderRadius: 24,
        overflow: 'hidden',
        shadowRadius: 16,
        elevation: 8,
    },
    content: {
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
    },
});

export default AnimatedPostCard;
