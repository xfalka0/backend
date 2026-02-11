import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    interpolate
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function WelcomeButton({ title, icon, onPress, variant = 'glass', gradient }) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    const handlePressIn = () => {
        scale.value = withSpring(0.96);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    const renderContent = () => (
        <>
            {icon && <Ionicons name={icon} size={24} color="white" style={styles.icon} />}
            <Text style={styles.text}>{title}</Text>
        </>
    );

    if (variant === 'gradient') {
        return (
            <AnimatedTouchableOpacity
                activeOpacity={1}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={onPress}
                style={[styles.button, animatedStyle]}
            >
                <LinearGradient
                    colors={gradient || ['#8b5cf6', '#ec4899']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradient}
                >
                    {renderContent()}
                </LinearGradient>
            </AnimatedTouchableOpacity>
        );
    }

    return (
        <AnimatedTouchableOpacity
            activeOpacity={1}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
            style={[styles.button, styles.glassButton, animatedStyle]}
        >
            <BlurView intensity={20} style={styles.blur}>
                {renderContent()}
            </BlurView>
        </AnimatedTouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        width: '100%',
        height: 60,
        borderRadius: 30,
        marginBottom: 16,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    glassButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    gradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    blur: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        marginRight: 12,
    },
    text: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});
