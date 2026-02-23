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
        asset: require('../../assets/vip_frames/vip1_v2.png'),
        glow: 'rgba(205, 127, 50, 0.3)',
        innerScale: 0.80,
        frameScale: 1.6,
        avatarOffset: { top: 1, left: 0 },
        frameOffset: { top: 5, left: -1 },
    },
    2: {
        colors: ['#cbd5e1', '#94a3b8'], // Silver
        asset: require('../../assets/vip_frames/vip2_v2.png'),
        glow: 'rgba(203, 213, 225, 0.4)',
        innerScale: 0.8,
        frameScale: 1.55,
        avatarOffset: { top: 1, left: 0 },
        frameOffset: { top: 0, left: 0 },
    },
    3: {
        colors: ['#fbbf24', '#d97706'], // Gold
        asset: require('../../assets/vip_frames/vip3_v2.png'),
        hasShine: true,
        glow: 'rgba(251, 191, 36, 0.5)',
        innerScale: 0.80,
        frameScale: 1.6,
        avatarOffset: { top: 1, left: 0 },
        frameOffset: { top: 6, left: -1 },
    },
    4: {
        colors: ['#22d3ee', '#0891b2'], // Platinum
        asset: require('../../assets/vip_frames/vip4_v2.png'),
        hasParticles: true,
        glow: 'rgba(34, 211, 238, 0.6)',
        innerScale: 0.80,
        frameScale: 1.75,
        avatarOffset: { top: 1, left: -1 },
        frameOffset: { top: 10, left: -3 },
    },
    5: {
        colors: ['#e879f9', '#d946ef'], // Diamond
        asset: require('../../assets/vip_frames/vip5_v2.png'),
        hasHalo: true,
        glow: 'rgba(232, 121, 249, 0.8)',
        innerScale: 0.80,
        frameScale: 1.75,
        avatarOffset: { top: 1, left: -2 },
        frameOffset: { top: 10, left: -4 },
    },
    6: {
        colors: ['#1a1a1a', '#000000', '#fbbf24'],

        asset: require('../../assets/vip_frames/vip6_v2.png'),
        hasGoldenRain: true,
        glow: 'rgba(251, 191, 36, 1)',
        innerScale: 0.85,
        frameScale: 1.7,
        avatarOffset: { top: 0, left: 3 },
        frameOffset: { top: 0, left: 0 },
    }
};

const VipFrame = memo(({ level = 0, avatar, size = 80, isStatic = false }) => {
    const { theme } = useTheme();
    const [hasError, setHasError] = useState(false);
    const config = VIP_FRAME_CONFIGS[level];
    const pulseValue = useSharedValue(1);

    useEffect(() => {
        setHasError(false); // Reset error when avatar changes
    }, [avatar]);

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
        if (typeof avatar === 'string' && avatar.trim().length > 0) {
            let finalUri = avatar.trim();
            // DOUBLE SAFETY: If still relative, prepend base URL
            if (finalUri.startsWith('/uploads') && !finalUri.startsWith('http')) {
                const baseUrl = API_URL.replace('/api', '');
                finalUri = `${baseUrl}${finalUri}`;
            }
            return { uri: finalUri };
        }
        if (typeof avatar === 'number') {
            return avatar;
        }
        return null;
    };

    const renderAvatarInternal = (innerSizeValue, isInsideFrame = false) => {
        const source = getAvatarSource();
        const avatarOffset = config?.avatarOffset || { top: 0, left: 0 };

        if (!source || hasError) {
            return (
                <View style={{
                    width: innerSizeValue,
                    height: innerSizeValue,
                    borderRadius: innerSizeValue / 2,
                    backgroundColor: theme.colors.backgroundSecondary || '#1e293b',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: isInsideFrame ? [
                        { translateX: avatarOffset.left },
                        { translateY: avatarOffset.top }
                    ] : []
                }}>
                    <Ionicons name="person" size={innerSizeValue * 0.6} color={theme.colors.textSecondary || '#64748b'} />
                </View>
            );
        }

        return (
            <Image
                source={source}
                style={{
                    width: isInsideFrame ? '100%' : innerSizeValue,
                    height: isInsideFrame ? '100%' : innerSizeValue,
                    borderRadius: innerSizeValue / 2,
                    resizeMode: 'cover',
                    transform: isInsideFrame ? [
                        { translateX: avatarOffset.left },
                        { translateY: avatarOffset.top }
                    ] : []
                }}
                onError={() => setHasError(true)}
            />
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
                    elevation: 10,
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
                        elevation: 6,
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
