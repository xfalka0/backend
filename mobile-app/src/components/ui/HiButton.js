import React, { memo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import ModernAlert from './ModernAlert';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    runOnJS,
} from 'react-native-reanimated';

const RESET_DURATION = 24 * 60 * 60 * 1000;

// Global synchronous cache to prevent ANY flickers when parent components force a remount
const localChatCache = new Set();

const Particle = ({ index, onComplete }) => {
    const pos = useSharedValue(0);
    const opacity = useSharedValue(1);
    
    const angle = (index * 60) * (Math.PI / 180);
    const dist = 40 + Math.random() * 30;
    const destX = Math.cos(angle) * dist;
    const destY = Math.sin(angle) * dist;

    useEffect(() => {
        pos.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }, (finished) => {
            if (finished && onComplete) runOnJS(onComplete)();
        });
        opacity.value = withTiming(0, { duration: 600 });
    }, []);

    const style = useAnimatedStyle(() => ({
        transform: [
            { translateX: pos.value * destX },
            { translateY: pos.value * destY },
            { scale: 1 - pos.value * 0.5 }
        ],
        opacity: opacity.value
    }));

    return (
        <Animated.View style={[styles.particle, style]}>
            <Ionicons name="heart" size={12} color="#ec4899" />
        </Animated.View>
    );
};

const HiButton = memo(({ onPress, operatorId, onHiPress }) => {
    const scale = useSharedValue(1);
    const pulse = useSharedValue(1);
    const [particles, setParticles] = useState([]);
    
    // 1. Synchronous initialization! If it was pressed in this session, it starts as 'Chat' instantly.
    const [isChatMode, setIsChatMode] = useState(() => localChatCache.has(operatorId));
    const [alertVisible, setAlertVisible] = useState(false);

    useEffect(() => {
        if (!isChatMode) {
            checkHiStatus();
        }
    }, [operatorId]);

    useEffect(() => {
        if (!isChatMode) {
            pulse.value = withRepeat(
                withSequence(
                    withTiming(1.05, { duration: 400, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
                    withTiming(1, { duration: 1200, easing: Easing.bezier(0.4, 0, 0.2, 1) })
                ),
                -1,
                false
            );
        } else {
            pulse.value = 1;
        }
    }, [isChatMode]);

    const checkHiStatus = async () => {
        try {
            if (localChatCache.has(operatorId)) {
                if (!isChatMode) setIsChatMode(true);
                return;
            }

            const lastHiStr = await AsyncStorage.getItem(`lastHi_${operatorId}`);
            if (lastHiStr) {
                const lastHiTime = parseInt(lastHiStr);
                if (Date.now() - lastHiTime < RESET_DURATION) {
                    localChatCache.add(operatorId); // Update global cache
                    setIsChatMode(true);
                }
            }
        } catch (e) {}
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value * pulse.value }],
        shadowOpacity: !isChatMode ? 0.3 + (pulse.value - 1) * 5 : 0.2,
        shadowRadius: !isChatMode ? 8 + (pulse.value - 1) * 30 : 6,
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.9);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    const removeParticle = useCallback((id) => {
        setParticles(prev => prev.filter(p => p.id !== id));
    }, []);

    const handlePress = async () => {
        if (!isChatMode && !localChatCache.has(operatorId)) {
            // Instantly lock it globally and locally
            localChatCache.add(operatorId);
            setIsChatMode(true);
            
            // Trigger Particle Burst
            const newParticles = Array.from({ length: 6 }).map((_, i) => ({
                id: Date.now() + i,
                index: i
            }));
            setParticles(newParticles);

            const now = Date.now();
            AsyncStorage.setItem(`lastHi_${operatorId}`, now.toString()).catch(() => {});
            
            if (onHiPress) onHiPress();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            if (onPress) onPress();
        }
    };

    return (
        <View style={styles.container}>
            <TouchableWithoutFeedback
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
            >
                <View style={styles.buttonContainer}>
                    <View style={styles.particleLayer} pointerEvents="none">
                        {particles.map(p => (
                            <Particle 
                                key={p.id} 
                                index={p.index} 
                                onComplete={() => removeParticle(p.id)} 
                            />
                        ))}
                    </View>

                    <Animated.View style={[styles.buttonWrapper, animatedStyle]}>
                        <LinearGradient
                            colors={isChatMode ? ['#3b82f6', '#8b5cf6'] : ['#ec4899', '#8b5cf6']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.buttonBase}
                        >
                            <Text style={styles.buttonText}>{isChatMode ? 'Chat' : 'Hi'}</Text>
                            <View style={[styles.bubbleTail, { backgroundColor: isChatMode ? '#8b5cf6' : '#8b5cf6' }]} />
                        </LinearGradient>
                    </Animated.View>
                </View>
            </TouchableWithoutFeedback>

            <ModernAlert
                visible={alertVisible}
                title="Günlük Limit"
                message="Günde en fazla 10 kişiye 'Hi' diyebilirsin."
                type="warning"
                onClose={() => setAlertVisible(false)}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    particleLayer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },
    particle: {
        position: 'absolute',
    },
    buttonWrapper: {
        shadowColor: "#ec4899",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonBase: {
        paddingHorizontal: 22,
        paddingVertical: 8,
        borderRadius: 22,
        minWidth: 70,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    buttonText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 14,
    },
    bubbleTail: {
        position: 'absolute',
        bottom: -2,
        right: 4,
        width: 10,
        height: 10,
        transform: [{ rotate: '45deg' }],
        borderBottomRightRadius: 3,
        zIndex: -1,
    }
});

export default HiButton;
