import React, { useEffect } from 'react';
import { View, Text, TouchableWithoutFeedback, StyleSheet, Platform } from 'react-native';
import { STORE_THEME } from '../../constants/storeTheme';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolateColor, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export default function PlanCard({ plan, isSelected, onSelect, baseMonthlyPrice = 449.99 }) {
    // Parse numeric prices
    const totalNum = parseFloat(plan.price.replace(/[^0-9,.]/g, '').replace(',', '.'));
    const monthlyNum = totalNum / plan.months;
    const monthlyPriceText = `${Math.round(monthlyNum)} ₺/ay`;

    let savingsPercent = 0;
    if (baseMonthlyPrice > 0 && plan.months > 1) {
        savingsPercent = Math.round((1 - (monthlyNum / baseMonthlyPrice)) * 100);
    }

    const durationText = `${plan.months} Ay`;

    const scale = useSharedValue(isSelected ? STORE_THEME.animations.cardScaleMax : 1);
    const progress = useSharedValue(isSelected ? 1 : 0);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        progress.value = withTiming(isSelected ? 1 : 0, { duration: STORE_THEME.animations.cardSelectionDuration });
        if (isSelected && !reduceMotion) {
            scale.value = withSpring(STORE_THEME.animations.cardScaleMax, { damping: 15, stiffness: 200 });
        } else {
            scale.value = withSpring(1, { damping: 15, stiffness: 200 });
        }
    }, [isSelected, reduceMotion]);

    const handleSelect = () => {
        if (!isSelected) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onSelect();
        }
    };

    const animatedCardStyle = useAnimatedStyle(() => {
        if (reduceMotion) {
            return {
                backgroundColor: isSelected ? '#2A1D10' : '#1A0F14',
                borderColor: isSelected ? '#FFC53D' : 'rgba(255, 255, 255, 0.08)',
                borderWidth: isSelected ? 1.5 : 1,
            };
        }
        return {
            transform: [{ scale: scale.value }],
            backgroundColor: interpolateColor(progress.value, [0, 1], ['#1A0F14', '#2A1D10']),
            borderColor: interpolateColor(progress.value, [0, 1], ['rgba(255, 255, 255, 0.08)', '#FFC53D']),
            borderWidth: progress.value * 0.5 + 1, // 1 to 1.5
        };
    });

    const animatedGlowStyle = useAnimatedStyle(() => ({
        opacity: reduceMotion ? (isSelected ? 1 : 0) : progress.value,
        transform: [{ scale: scale.value }]
    }));

    return (
        <View style={styles.wrapper}>
            {/* Custom Glow Effect (No Elevation) */}
            <Animated.View style={[styles.glowEffect, animatedGlowStyle]} pointerEvents="none" />
            
            <TouchableWithoutFeedback
                onPress={handleSelect}
                accessibilityLabel={`${durationText}, aylık ${monthlyPriceText}, toplam ${plan.price}${isSelected ? ', seçili' : ''}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
            >
                <Animated.View style={[styles.card, animatedCardStyle]}>
                    {/* Top Badges */}
                    <View style={styles.badgeRow}>
                        {plan.badge ? (
                            <View style={[
                                styles.badge,
                                plan.badge === 'POPÜLER' ? styles.badgePopular : styles.badgeBest
                            ]}>
                                <Text style={styles.badgeText}>{plan.badge}</Text>
                            </View>
                        ) : null}

                        {savingsPercent > 0 ? (
                            <View style={styles.badgeSavings}>
                                <Text style={styles.badgeSavingsText}>%{savingsPercent} TASARRUF</Text>
                            </View>
                        ) : null}
                    </View>

                    {/* Main Info Row */}
                    <View style={styles.contentRow}>
                        {/* Left Side: Duration & Monthly price */}
                        <View style={styles.leftCol}>
                            <Text style={[
                                styles.durationText,
                                isSelected ? styles.durationTextSelected : styles.durationTextUnselected
                            ]}>
                                {durationText}
                            </Text>
                            <Text style={styles.monthlyText}>{monthlyPriceText}</Text>
                        </View>

                        {/* Right Side: Total Price */}
                        <View style={styles.rightCol}>
                            <Text style={[
                                styles.totalPrice,
                                isSelected ? styles.totalPriceSelected : styles.totalPriceUnselected
                            ]}>
                                {plan.price}
                            </Text>
                        </View>
                    </View>

                    {/* Selection Check Circle */}
                    <View style={[
                        styles.radioCircle,
                        isSelected ? styles.radioSelected : styles.radioUnselected
                    ]}>
                        {isSelected ? <View style={styles.radioInnerCircle} /> : null}
                    </View>
                </Animated.View>
            </TouchableWithoutFeedback>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
        marginBottom: 8,
        position: 'relative',
    },
    glowEffect: {
        position: 'absolute',
        top: -6,
        bottom: -6,
        left: -6,
        right: -6,
        backgroundColor: 'rgba(255, 197, 61, 0.12)',
        borderRadius: 24,
        zIndex: 0,
        ...Platform.select({
            ios: {
                shadowColor: '#FFC53D',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.4,
                shadowRadius: 14,
            },
        }),
    },
    card: {
        width: '100%',
        borderRadius: 18,
        paddingVertical: 10,
        paddingHorizontal: 16,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    badgePopular: {
        backgroundColor: 'rgba(255, 197, 61, 0.2)',
        borderWidth: 1,
        borderColor: STORE_THEME.colors.accentGold,
    },
    badgeBest: {
        backgroundColor: 'rgba(255, 61, 110, 0.2)',
        borderWidth: 1,
        borderColor: '#FF3D6E',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: STORE_THEME.colors.textWhite,
        letterSpacing: 0.5,
    },
    badgeSavings: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 197, 61, 0.15)',
    },
    badgeSavingsText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: STORE_THEME.colors.accentGold,
        letterSpacing: 0.5,
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: 28,
        backgroundColor: 'transparent',
    },
    leftCol: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    durationText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    durationTextSelected: {
        color: STORE_THEME.colors.textWhite,
    },
    durationTextUnselected: {
        color: STORE_THEME.colors.textMuted,
    },
    monthlyText: {
        fontSize: 13,
        fontWeight: '500',
        color: STORE_THEME.colors.textMuted,
    },
    rightCol: {
        alignItems: 'flex-end',
        backgroundColor: 'transparent',
    },
    totalPrice: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    totalPriceSelected: {
        color: STORE_THEME.colors.accentGold,
    },
    totalPriceUnselected: {
        color: STORE_THEME.colors.textWhite,
    },
    radioCircle: {
        position: 'absolute',
        right: 16,
        top: '50%',
        marginTop: -10,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioSelected: {
        borderWidth: 2,
        borderColor: STORE_THEME.colors.accentGold,
    },
    radioUnselected: {
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    radioInnerCircle: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: STORE_THEME.colors.accentGold,
    },
});
