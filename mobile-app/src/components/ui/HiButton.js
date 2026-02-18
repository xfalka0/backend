import React, { memo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback, Alert } from 'react-native';
import ModernAlert from './ModernAlert';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withSequence,
    interpolate,
} from 'react-native-reanimated';

const BUBBLE_COUNT = 15;
const RESET_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const DAILY_LIMIT = 1000;

const Bubble = memo(({ index, triggerValue }) => {
    const progress = useSharedValue(0);
    const angle = (index * (360 / BUBBLE_COUNT)) * (Math.PI / 180);
    const distance = 40 + Math.random() * 50;

    const animatedStyle = useAnimatedStyle(() => {
        const opacity = interpolate(progress.value, [0, 0.1, 0.7, 1], [0, 1, 1, 0]);
        const scale = interpolate(progress.value, [0, 0.1, 0.9, 1], [0, 1.2, 0.8, 0]);
        const translateX = Math.cos(angle) * distance * progress.value;
        const translateY = Math.sin(angle) * distance * progress.value;

        return {
            opacity,
            transform: [
                { translateX },
                { translateY },
                { scale }
            ]
        };
    });

    React.useEffect(() => {
        if (triggerValue.value > 0) {
            progress.value = 0;
            progress.value = withTiming(1, { duration: 500 + Math.random() * 300 });
        }
    }, [triggerValue.value]);

    return (
        <Animated.View style={[styles.bubble, animatedStyle]} />
    );
});

export default function HiButton({ onPress, operatorId, onHiPress }) {
    const scale = useSharedValue(1);
    const triggerValue = useSharedValue(0);
    const [renderKey, setRenderKey] = useState(0);
    const [isChatMode, setIsChatMode] = useState(false);
    const [alertVisible, setAlertVisible] = useState(false);

    useEffect(() => {
        checkHiStatus();
    }, [operatorId]);

    const checkHiStatus = async () => {
        try {
            const lastHiStr = await AsyncStorage.getItem(`lastHi_${operatorId}`);
            if (lastHiStr) {
                const lastHiTime = parseInt(lastHiStr);
                const now = Date.now();
                if (now - lastHiTime < RESET_DURATION) {
                    setIsChatMode(true);
                } else {
                    await AsyncStorage.removeItem(`lastHi_${operatorId}`);
                    setIsChatMode(false);
                }
            } else {
                setIsChatMode(false);
            }
        } catch (e) {
            console.error('HiButton status check error:', e);
        }
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.85);
        if (!isChatMode) {
            // Instant feedback
            triggerValue.value += 1;
            setRenderKey(prev => prev + 1);
        }
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    const handlePress = async () => {
        // Hızlı tıklamalarda animasyonun görünmesi için zorla çalıştırıyoruz
        // Önce küçült (0.85), sonra geri büyüt (1.0)
        scale.value = withSequence(
            withTiming(0.85, { duration: 100 }),
            withTiming(1, { duration: 250 })
        );

        // Animasyonun bitmesi için bekle
        await new Promise(resolve => setTimeout(resolve, 350));

        if (!isChatMode) {
            try {
                const now = Date.now();

                // --- DAILY LIMIT CHECK ---
                const historyStr = await AsyncStorage.getItem('hi_history');
                let history = historyStr ? JSON.parse(historyStr) : [];

                // Filter history for last 24 hours
                const validHistory = history.filter(time => now - time < RESET_DURATION);

                if (validHistory.length >= DAILY_LIMIT) {
                    setAlertVisible(true);
                    return;
                }

                // Save time for this operator
                await AsyncStorage.setItem(`lastHi_${operatorId}`, now.toString());

                // Update global history
                validHistory.push(now);
                await AsyncStorage.setItem('hi_history', JSON.stringify(validHistory));

                setIsChatMode(true);
                if (onHiPress) {
                    onHiPress(); // This will send "Merhaba"
                }
            } catch (e) {
                console.error('HiButton save error:', e);
            }
        } else {
            // Second click: Normal navigation
            if (onPress) {
                onPress();
            }
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.bubblesLayer} pointerEvents="none">
                {[...Array(BUBBLE_COUNT)].map((_, i) => (
                    <Bubble key={`${renderKey}-${i}`} index={i} triggerValue={triggerValue} />
                ))}
            </View>

            <TouchableWithoutFeedback
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
            >
                <Animated.View style={[styles.buttonWrapper, animatedStyle]}>
                    <View style={[
                        styles.buttonBase,
                        isChatMode && styles.chatModeButton
                    ]}>
                        {isChatMode ? (
                            <View style={styles.chatButtonContent}>
                                <LinearGradient
                                    colors={['#ff8a4c', '#ff5e95']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.chatModeBorder}
                                >
                                    <View style={styles.chatModeInner}>
                                        <Text style={styles.chatText}>Chat</Text>
                                    </View>
                                </LinearGradient>
                                <View style={styles.bubbleTail} />
                            </View>
                        ) : (
                            <LinearGradient
                                colors={['#ff8a4c', '#ff5e95']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.hiButton}
                            >
                                <Text style={styles.hiText}>Hi</Text>
                                <View style={styles.bubbleTail} />
                            </LinearGradient>
                        )}
                    </View>
                </Animated.View>
            </TouchableWithoutFeedback>

            <ModernAlert
                visible={alertVisible}
                title="Günlük Limit"
                message="Günde en fazla 10 kişiye 'Hi' diyebilirsin. Yarın tekrar dene!"
                type="warning"
                onClose={() => setAlertVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
    },
    buttonWrapper: {
        zIndex: 5,
    },
    buttonBase: {
        borderRadius: 20,
        overflow: 'visible',
    },
    bubblesLayer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 1,
        height: 1,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    bubble: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ff5e95',
        shadowColor: "#ff0000",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 3,
        elevation: 5,
    },
    hiButton: {
        paddingHorizontal: 28,
        paddingVertical: 9,
        borderRadius: 20,
        position: 'relative',
        shadowColor: "#ff5e95",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
        minWidth: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatModeButton: {
        backgroundColor: 'transparent',
    },
    chatButtonContent: {
        position: 'relative',
    },
    chatModeBorder: {
        padding: 1.5, // Border width
        borderRadius: 20,
        minWidth: 80,
    },
    chatModeInner: {
        backgroundColor: 'rgba(255, 255, 255, 0.85)', // Semi-transparent white
        paddingHorizontal: 26.5, // 28 - 1.5
        paddingVertical: 7.5, // 9 - 1.5
        borderRadius: 18.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bubbleTail: {
        position: 'absolute',
        bottom: -2,
        right: 4,
        width: 11,
        height: 11,
        backgroundColor: '#ff5e95',
        transform: [{ rotate: '45deg' }],
        borderBottomRightRadius: 3,
    },
    hiText: {
        color: 'white',
        fontWeight: '950',
        fontSize: 14,
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    chatText: {
        color: '#ff5e95',
        fontWeight: '950', // Match Hi text weight
        fontSize: 14,
    }
});
