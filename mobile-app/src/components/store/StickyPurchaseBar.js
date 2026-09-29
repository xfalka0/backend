import React, { useEffect, useState } from 'react';
import { View, Text, TouchableWithoutFeedback, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STORE_THEME } from '../../constants/storeTheme';
import { LAYOUT } from '../../theme';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, useReducedMotion, runOnJS, withSpring, FadeInUp } from 'react-native-reanimated';

export default function StickyPurchaseBar({ onPress, loading = false, planLabel = '' }) {
    const insets = useSafeAreaInsets();
    const tabOffset = LAYOUT.tabBarHeight + LAYOUT.tabBarBottomOffset;
    const reduceMotion = useReducedMotion();

    const pulseScale = useSharedValue(1);
    const pressScale = useSharedValue(1);
    
    const labelOpacity = useSharedValue(1);
    const [displayLabel, setDisplayLabel] = useState(planLabel);

    useEffect(() => {
        if (!reduceMotion) {
            pulseScale.value = withRepeat(
                withTiming(STORE_THEME.animations.buttonPulseScaleMax, { 
                    duration: STORE_THEME.animations.buttonPulseDuration / 2, 
                    easing: Easing.inOut(Easing.ease) 
                }),
                -1,
                true // reverse
            );
        }
    }, [reduceMotion]);

    useEffect(() => {
        if (planLabel && planLabel !== displayLabel) {
            if (reduceMotion) {
                setDisplayLabel(planLabel);
            } else {
                labelOpacity.value = withTiming(0, { duration: 150 }, () => {
                    runOnJS(setDisplayLabel)(planLabel);
                    labelOpacity.value = withTiming(1, { duration: 150 });
                });
            }
        } else if (!displayLabel && planLabel) {
            setDisplayLabel(planLabel);
        }
    }, [planLabel, reduceMotion]);

    const handlePressIn = () => {
        if (!reduceMotion) pressScale.value = withSpring(STORE_THEME.animations.buttonPulseScaleMin, { damping: 15 });
    };

    const handlePressOut = () => {
        if (!reduceMotion) pressScale.value = withSpring(1, { damping: 15 });
    };

    const animatedButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value * pressScale.value }]
    }));

    const animatedLabelStyle = useAnimatedStyle(() => ({
        opacity: labelOpacity.value
    }));

    return (
        <Animated.View entering={FadeInUp.delay(13 * STORE_THEME.animations.staggerDelay).duration(400)} style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) + tabOffset + 12 }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0305' }]} pointerEvents="none" />
            <LinearGradient
                colors={['rgba(10, 3, 5, 0)', '#0A0305']}
                style={{ position: 'absolute', top: -40, left: 0, right: 0, height: 40 }}
                pointerEvents="none"
            />

            <View style={styles.container}>
                <TouchableWithoutFeedback
                    onPress={onPress}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={loading}
                    accessibilityLabel={`Premium'a Geç. ${planLabel ? planLabel + ' seçili.' : ''}`}
                    accessibilityRole="button"
                >
                    <Animated.View style={[styles.button, animatedButtonStyle]}>
                        <LinearGradient
                            colors={STORE_THEME.colors.primaryGradient}
                            style={styles.buttonGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <>
                                    <Text style={styles.buttonText}>Premium'a Geç</Text>
                                    {displayLabel ? (
                                        <Animated.Text style={[styles.planLabelInside, animatedLabelStyle]}>
                                            {displayLabel}
                                        </Animated.Text>
                                    ) : null}
                                </>
                            )}
                        </LinearGradient>
                    </Animated.View>
                </TouchableWithoutFeedback>

                <Text style={styles.subtext}>İstediğin zaman iptal edebilirsin</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingTop: 16,
    },
    container: {
        paddingHorizontal: STORE_THEME.spacing.paddingHorizontal,
        alignItems: 'center',
    },
    planLabelInside: {
        fontSize: 13,
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.85)',
        marginTop: 1,
        letterSpacing: 0.2,
    },
    button: {
        width: '100%',
        height: 60,
        borderRadius: 30,
        overflow: 'hidden',
        ...STORE_THEME.shadows.buttonShadow,
    },
    buttonGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 17,
        fontWeight: 'bold',
        color: STORE_THEME.colors.textWhite,
        letterSpacing: 0.3,
    },
    subtext: {
        fontSize: 12,
        color: STORE_THEME.colors.textGray,
        marginTop: 8,
        textAlign: 'center',
    },
});
