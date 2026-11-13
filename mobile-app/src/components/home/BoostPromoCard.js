import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    withSpring,
    cancelAnimation,
    useReducedMotion,
    Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAppStore } from '../../store/useAppStore';
import { PERFORMANCE } from '../../config';
import GlassCard from '../ui/GlassCard';

const BoostPromoCard = ({ onPress }) => {
    const { theme } = useTheme();
    const isFocused = useIsFocused();
    const reducedMotion = useReducedMotion();
    const performanceMode = useAppStore(state => state.performanceMode);
    const animationsDisabled = PERFORMANCE.reduceMotion || performanceMode === 'low' || reducedMotion || !isFocused;

    const rocketScale = useSharedValue(1);
    const cardScale = useSharedValue(1);

    useEffect(() => {
        if (animationsDisabled) {
            cancelAnimation(rocketScale);
            rocketScale.value = 1;
            return;
        }

        // Single gentle pulse loop only in normal focused mode
        rocketScale.value = withRepeat(
            withSequence(
                withTiming(1.12, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
                withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        return () => {
            cancelAnimation(rocketScale);
            rocketScale.value = 1;
        };
    }, [animationsDisabled]);

    const rocketStyle = useAnimatedStyle(() => ({
        transform: [{ scale: rocketScale.value }]
    }));

    const cardAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }]
    }));

    const handlePressIn = () => {
        cardScale.value = withSpring(0.96);
    };

    const handlePressOut = () => {
        cardScale.value = withSpring(1);
    };

    return (
        <Animated.View style={[styles.container, cardAnimatedStyle]}>
            <TouchableOpacity
                activeOpacity={1}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
            >
                <GlassCard intensity={45} style={styles.card}>
                    <LinearGradient
                        colors={['#ec4899', '#8b5cf6', '#6366f1']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradient}
                    >
                        <View style={styles.content}>
                            <Animated.View style={[styles.iconContainer, rocketStyle]}>
                                <LinearGradient
                                    colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                                    style={styles.iconBg}
                                >
                                    <Ionicons name="rocket" size={32} color="white" />
                                </LinearGradient>
                                {/* Glow under icon */}
                                <View style={styles.iconGlow} />
                            </Animated.View>

                            <View style={styles.textWrapper}>
                                <Text style={styles.title}>Profilini Öne Çıkar!</Text>
                                <Text style={styles.desc}>1 gün boyunca keşfette en üstte yer alarak etkileşimini artır.</Text>
                            </View>

                            <View style={styles.badge}>
                                <Ionicons name="flash" size={12} color="#fcd34d" />
                                <Text style={styles.badgeText}>POPÜLER</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </GlassCard>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 25,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
    },
    card: {
        borderRadius: 24,
        overflow: 'hidden',
    },
    gradient: {
        paddingVertical: 20,
        paddingLeft: 10,
        paddingRight: 15,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    shineContainer: {
        position: 'absolute',
        top: -100, // Fixed negative offset
        left: 0,
        width: 150,
        height: 400, // Fixed height instead of percentage
        zIndex: 1,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        zIndex: 2,
    },
    iconContainer: {
        width: 64,
        height: 64,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconBg: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    iconGlow: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f472b6',
        opacity: 0.6,
        zIndex: -1,
        blurRadius: 20,
    },
    textWrapper: {
        flex: 1,
        marginLeft: 4,
    },
    title: {
        color: 'white',
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 4,
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    desc: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '600',
    },
    badge: {
        position: 'absolute',
        top: -10,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    badgeText: {
        color: '#fcd34d',
        fontSize: 10,
        fontWeight: '900',
    }
});

export default BoostPromoCard;
