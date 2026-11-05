import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    FadeIn,
    FadeOut
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function WelcomeButton({
    title,
    icon,
    onPress,
    variant = 'glass',
    gradient,
    loading = false,
    disabled = false,
    style,
}) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    const handlePressIn = () => {
        if (!loading && !disabled) scale.value = withSpring(0.96);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    const renderContent = () => (
        <View style={styles.contentContainer}>
            {loading ? (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(200)}
                    style={styles.loadingContainer}
                >
                    <ActivityIndicator size="small" color="white" />
                </Animated.View>
            ) : (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(200)}
                    style={styles.innerContent}
                >
                    {icon && <Ionicons name={icon} size={22} color="white" style={styles.icon} />}
                    <Text style={styles.text} numberOfLines={1} adjustsFontSizeToFit>
                        {title}
                    </Text>
                </Animated.View>
            )}
        </View>
    );

    if (variant === 'gradient' || variant === 'primary') {
        return (
            <AnimatedTouchableOpacity
                activeOpacity={0.8}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={onPress}
                disabled={loading || disabled}
                style={[styles.button, animatedStyle, style]}
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

    if (variant === 'outline') {
        return (
            <AnimatedTouchableOpacity
                activeOpacity={0.8}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={onPress}
                disabled={loading || disabled}
                style={[styles.button, styles.outlineButton, animatedStyle, style]}
            >
                {renderContent()}
            </AnimatedTouchableOpacity>
        );
    }

    return (
        <AnimatedTouchableOpacity
            activeOpacity={0.8}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
            disabled={loading || disabled}
            style={[styles.button, styles.glassButton, animatedStyle, style]}
        >
            <View style={styles.glassInner}>
                {renderContent()}
            </View>
        </AnimatedTouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        width: '100%',
        height: 52,
        borderRadius: 26,
        marginBottom: 12,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    glassButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
    },
    outlineButton: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.25)',
    },
    gradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    glassInner: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    innerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        marginRight: 10,
    },
    text: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Outfit_500Medium',
        letterSpacing: 0.3,
    },
});
