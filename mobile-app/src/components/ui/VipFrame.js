import React, { memo, useEffect, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    Easing
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../contexts/ThemeContext';
import { resolveImageUrl } from '../../utils/imageUtils';

/**
 * VIP_FRAME_CONFIGS: Grand Sugo Style Assets
 * All frames are 512x512 standardized pngs
 * 
 * MANUAL ADJUSTMENT PARAMETERS:
 * - avatarOffset: { top, left } - Moves the avatar within the frame
 * - frameOffset: { top, left } - Moves the entire frame
 * - innerScale: Avatar size multiplier (0.85 = 85% of base size)
 * - frameScale: Frame size multiplier (1.6 = 160% of base size)
 */
const VIP_FRAME_CONFIGS = {
    1: {
        colors: ['#cd7f32', '#a05a2c'], // Bronze
        asset: require('../../../assets/vip1cerceve.png'),
        glow: 'rgba(205, 127, 50, 0.3)',
        innerScale: 0.92,
        frameScale: 1.3,
        avatarOffset: { top: 0, left: 0 },
        frameOffset: { top: 0, left: 0 },
    },
    2: {
        colors: ['#cbd5e1', '#94a3b8'], // Silver
        asset: require('../../../assets/vip2cerceve.png'),
        glow: 'rgba(203, 213, 225, 0.4)',
        innerScale: 0.92,
        frameScale: 1.3,
        avatarOffset: { top: 0, left: 0 },
        frameOffset: { top: 0, left: 0 },
    },
    3: {
        colors: ['#fbbf24', '#d97706'], // Gold
        asset: require('../../../assets/vip3cerceve.png'),
        hasShine: true,
        glow: 'rgba(251, 191, 36, 0.5)',
        innerScale: 0.92,
        frameScale: 1.3,
        avatarOffset: { top: 0, left: 0 },
        frameOffset: { top: 0, left: 0 },
    },
    4: {
        colors: ['#22d3ee', '#0891b2'], // Platinum
        asset: require('../../../assets/vip4cerceve.png'),
        hasParticles: true,
        glow: 'rgba(34, 211, 238, 0.6)',
        innerScale: 0.92,
        frameScale: 1.3,
        avatarOffset: { top: 0, left: 0 },
        frameOffset: { top: 0, left: 0 },
    },
    5: {
        colors: ['#e879f9', '#d946ef'], // Diamond
        asset: require('../../../assets/vip5cerceve.png'),
        hasHalo: true,
        glow: 'rgba(232, 121, 249, 0.8)',
        innerScale: 0.92,
        frameScale: 1.3,
        avatarOffset: { top: 0, left: 0 },
        frameOffset: { top: 0, left: 0 },
    },
    6: {
        colors: ['#1a1a1a', '#000000', '#fbbf24'],
        asset: require('../../../assets/vip6cerceve.png'),
        hasGoldenRain: true,
        glow: 'rgba(251, 191, 36, 1)',
        innerScale: 0.92,
        frameScale: 1.3,
        avatarOffset: { top: 0, left: 0 },
        frameOffset: { top: 0, left: 0 },
    },
    'dealer': {
        colors: ['#00e5ff', '#00b8d4'],
        asset: require('../../assets/vip_frames/coin_dealer_frame.png'),
        glow: 'rgba(0, 229, 255, 0.8)',
        innerScale: 0.81, // Smaller to ensure it fits the hole completely
        frameScale: 1.9,
        avatarOffset: { top: 0, left: 0 }, // Negative offset to pull UP and LEFT
        frameOffset: { top: -7, left: 0 },
        hasPulse: true
    }
};

const VipFrame = memo(({ level = 0, avatar, size = 80, isStatic = false }) => {
    const { theme } = useTheme();
    const config = VIP_FRAME_CONFIGS[level];
    const pulseValue = useSharedValue(1);

    useEffect(() => {
        if (config?.hasPulse && !isStatic) {
            pulseValue.value = withRepeat(
                withSequence(
                    withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );
        } else {
            pulseValue.value = 1;
        }
    }, [level, isStatic]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseValue.value }],
    }));

    // Robust image source handler
    const getAvatarSource = () => {
        const resolved = resolveImageUrl(avatar, 'avatar');
        if (resolved) {
            return { uri: resolved };
        }
        if (typeof avatar === 'number') {
            return avatar;
        }
        return null;
    };

    const renderAvatarInternal = (innerSizeValue, isInsideFrame = false) => {
        const source = getAvatarSource();
        const avatarOffset = config?.avatarOffset || { top: 0, left: 0 };

        const fallback = (
            <View style={{
                width: innerSizeValue,
                height: innerSizeValue,
                borderRadius: innerSizeValue / 2,
                backgroundColor: theme.colors.backgroundSecondary || '#1e293b',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'absolute',
                top: 0,
                left: 0,
                transform: isInsideFrame ? [
                    { translateX: avatarOffset.left },
                    { translateY: avatarOffset.top }
                ] : []
            }}>
                <Ionicons name="person" size={innerSizeValue * 0.6} color={theme.colors.textSecondary || '#64748b'} />
            </View>
        );

        return (
            <View style={{ width: innerSizeValue, height: innerSizeValue }}>
                {fallback}
                {source && (
                    <Image
                        key={source.uri || (typeof avatar === 'string' ? avatar : JSON.stringify(avatar))}
                        source={source}
                        onError={(e) => console.log(`[DEBUG VipFrame Error] URI: ${source.uri || 'no-uri'}, Error:`, e.nativeEvent.error)}
                        onLoad={() => console.log(`[DEBUG VipFrame Success] URI: ${source.uri || 'no-uri'} loaded successfully`)}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: isInsideFrame ? '100%' : innerSizeValue,
                            height: isInsideFrame ? '100%' : innerSizeValue,
                            borderRadius: innerSizeValue / 2,
                            resizeMode: 'cover',
                            transform: isInsideFrame ? [
                                { translateX: avatarOffset.left },
                                { translateY: avatarOffset.top }
                            ] : []
                        }}
                    />
                )}
            </View>
        );
    };

    if (!level || level === 0 || !config) {
        return (
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                {renderAvatarInternal(size)}
            </View>
        );
    }

    const frameSize = size * (config.frameScale || 1.6);
    const innerSize = size * (config.innerScale || 0.85);
    const avatarOffset = config.avatarOffset || { top: 0, left: 0 };
    const frameOffset = config.frameOffset || { top: 0, left: 0 };

    // Wrapper style: Large Frame (Absolute Centered)
    const wrapperStyle = {
        position: 'absolute',
        width: frameSize,
        height: frameSize,
        top: (size - frameSize) / 2,
        left: (size - frameSize) / 2,
        alignItems: 'center',
        justifyContent: 'center',
    };


    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Animated.View style={[wrapperStyle, !isStatic && animatedStyle, { zIndex: 1 }]}>

                {/* 1. Glow (Absolute) */}
                <View style={{
                    position: 'absolute',
                    width: innerSize,
                    height: innerSize,
                    borderRadius: innerSize / 2,
                    shadowColor: config.colors[0],
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 20,
                    backgroundColor: 'transparent',
                    zIndex: 1,
                }} />

                {/* 2. Lottie Internal (Absolute) Removed */}

                {/* 3. Avatar (Absolute Center + Manual Offset) */}
                <View style={{
                    position: 'absolute',
                    width: innerSize,
                    height: innerSize,
                    borderRadius: innerSize / 2,
                    backgroundColor: theme.colors.glass,
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 3,
                    elevation: 5,
                    transform: [
                        { translateX: avatarOffset.left },
                        { translateY: avatarOffset.top }
                    ],
                }}>
                    {renderAvatarInternal(innerSize, true)}
                </View>

                {/* 4. Frame (Absolute Top-Left + Manual Offset) */}
                <Image
                    source={config.asset}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: frameSize,
                        height: frameSize,
                        zIndex: 4,
                        marginTop: frameOffset.top,
                        marginLeft: frameOffset.left,
                    }}
                    resizeMode="contain"
                />

                {/* 5. Crown (Absolute Top Offset) Removed */}

            </Animated.View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
    },
});

export default VipFrame;
