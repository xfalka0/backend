import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withSpring,
    withSequence
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import VipFrame from '../ui/VipFrame';
import GlassCard from '../ui/GlassCard';
import HeartBurst from './HeartBurst';
import { useTheme } from '../../contexts/ThemeContext';

const MessageBubble = ({ children, isMine, index, isRead, avatar, vipLevel = 0, timestamp }) => {
    const { theme, themeMode } = useTheme();
    const translateX = useSharedValue(isMine ? 50 : -50);
    const opacity = useSharedValue(0);

    const [lastTap, setLastTap] = useState(null);
    const [reacted, setReacted] = useState(false);
    const reactScale = useSharedValue(0);

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const handlePress = () => {
        const now = Date.now();
        const DOUBLE_PRESS_DELAY = 300;
        if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
            setReacted(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            reactScale.value = withSequence(
                withTiming(1, { duration: 150 }),
                withSpring(1.2),
                withTiming(1, { duration: 100 })
            );
            setLastTap(null);
        } else {
            setLastTap(now);
        }
    };

    useEffect(() => {
        opacity.value = withDelay(index * 50, withTiming(1, { duration: 400 }));
        translateX.value = withDelay(
            index * 50,
            withSpring(0, { damping: 12, stiffness: 100 })
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateX: translateX.value }],
    }));

    // İçeriği tutan kısım (ortak child renderer)
    const renderContent = () => (
        <>
            {children}
            <View style={styles.footerContainer}>
                <Text style={[
                    styles.timeText,
                    isMine ? styles.timeMine : [
                        styles.timeTheirs,
                        { color: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : theme.colors.textSecondary }
                    ]
                ]}>
                    {formatTime(timestamp)}
                </Text>
                {isMine && (
                    <View style={styles.statusContainer}>
                        <Ionicons
                            name={isRead ? "checkmark-done" : "checkmark"}
                            size={14}
                            color={isRead ? "#60a5fa" : "rgba(255, 255, 255, 0.6)"}
                        />
                    </View>
                )}
            </View>
        </>
    );

    return (
        <View style={[styles.container, isMine ? styles.containerMine : styles.containerTheirs]}>
            {!isMine && (
                <View style={[styles.avatarWrapper, styles.avatarLeft]}>
                    <VipFrame
                        level={vipLevel}
                        avatar={avatar}
                        size={45}
                        isStatic={true}
                    />
                </View>
            )}

            <Animated.View style={[styles.bubbleWrapper, animatedStyle]}>
                <TouchableWithoutFeedback onPress={handlePress}>
                    <View>
                        {isMine ? (
                            <GlassCard
                                intensity={50}
                                tint={themeMode === 'dark' ? 'dark' : 'light'}
                                style={[styles.bubble, styles.mine]}
                                noBorder={false}
                            >
                                <LinearGradient
                                    colors={['rgba(139, 92, 246, 0.6)', 'rgba(217, 70, 239, 0.8)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={StyleSheet.absoluteFill}
                                />
                                <View style={{ position: 'relative', zIndex: 1 }}>
                                    {renderContent()}
                                </View>
                            </GlassCard>
                        ) : (
                            <GlassCard intensity={30} tint={themeMode === 'dark' ? 'dark' : 'light'} style={[styles.bubble, styles.theirs]}>
                                <View style={{ position: 'relative', zIndex: 1 }}>
                                    {renderContent()}
                                </View>
                            </GlassCard>
                        )}

                        {reacted && (
                            <Animated.View style={[
                                styles.reactionBadge,
                                {
                                    right: isMine ? undefined : -5,
                                    left: isMine ? -5 : undefined,
                                    transform: [{ scale: reactScale }],
                                    backgroundColor: themeMode === 'dark' ? '#1f2937' : '#ffffff',
                                    borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                }
                            ]}>
                                <HeartBurst count={6} color="#ff5e95" />
                                <Ionicons name="heart" size={14} color="#ff5e95" />
                            </Animated.View>
                        )}
                    </View>
                </TouchableWithoutFeedback>
            </Animated.View>

            {isMine && (
                <View style={[styles.avatarWrapper, styles.avatarRight]}>
                    <VipFrame
                        level={vipLevel}
                        avatar={avatar}
                        size={45}
                        isStatic={true}
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginVertical: 4,
        paddingHorizontal: 8,
    },
    containerMine: {
        justifyContent: 'flex-end',
    },
    containerTheirs: {
        justifyContent: 'flex-start',
    },
    bubbleWrapper: {
        maxWidth: '70%',
    },
    bubble: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        overflow: 'hidden',
    },
    avatarWrapper: {
        marginBottom: 2,
    },
    avatarLeft: {
        marginRight: 8,
    },
    avatarRight: {
        marginLeft: 8,
    },
    reactionBadge: {
        position: 'absolute',
        bottom: -5,
        borderRadius: 12,
        padding: 3,
        borderWidth: 1,
        zIndex: 10,
        elevation: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
    },
    mine: {
        borderBottomRightRadius: 4,
    },
    theirs: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomRightRadius: 20,
        borderBottomLeftRadius: 4,
    },
    statusContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginLeft: 4,
    },
    footerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
        marginBottom: -2,
    },
    timeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    timeMine: {
        color: '#ffffff',
        opacity: 0.8,
    },
    timeTheirs: {
    },
});

export default MessageBubble;
