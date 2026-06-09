import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';
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

const REACTION_EMOJIS = [
    { type: 'heart', icon: '❤️' },
    { type: 'laugh', icon: '😂' },
    { type: 'wow', icon: '😮' },
    { type: 'fire', icon: '🔥' },
    { type: 'like', icon: '👍' },
];

const MessageBubble = React.memo(({ children, isMine, index, isRead, avatar, vipLevel = 0, timestamp, reaction, onReaction, isReplied, earnedDiamonds, isOperator }) => {
    const { theme, themeMode } = useTheme();
    const translateX = useSharedValue(isMine ? 50 : -50);
    const opacity = useSharedValue(0);

    const [lastTap, setLastTap] = useState(null);
    const [reacted, setReacted] = useState(!!reaction);
    const [showPicker, setShowPicker] = useState(false);
    const reactScale = useSharedValue(reaction ? 1 : 0);

    useEffect(() => {
        if (reaction) {
            setReacted(true);
            reactScale.value = withSpring(1);
        } else {
            setReacted(false);
            reactScale.value = withTiming(0);
        }
    }, [reaction]);

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const handlePress = () => {
        const now = Date.now();
        const DOUBLE_PRESS_DELAY = 300;
        if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
            if (!reacted) {
                setReacted(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                reactScale.value = withSequence(
                    withTiming(1, { duration: 150 }),
                    withSpring(1.2),
                    withTiming(1, { duration: 100 })
                );
                onReaction && onReaction('heart');
            }
            setLastTap(null);
        } else {
            setLastTap(now);
        }
    };

    const handleEmojiSelect = (emojiType) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowPicker(false);
        onReaction && onReaction(emojiType);
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

    const badgeAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: reactScale.value }],
    }));

    const getEmojiIcon = (type) => {
        const found = REACTION_EMOJIS.find(e => e.type === type);
        return found ? found.icon : '❤️';
    };

    // İçeriği tutan kısım (ortak child renderer)
    const renderContent = () => (
        <>
            {children}
            <View style={styles.footerContainer}>
                <Text style={[
                    styles.timeText,
                    isMine ? styles.timeMine : [
                        styles.timeTheirs,
                        { color: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : theme.colors.textSecondary }
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
                        size={35}
                        isStatic={true}
                    />
                </View>
            )}

            <View style={[styles.bubbleAndActions, isMine && { flexDirection: 'row-reverse' }]}>
                <Animated.View style={[styles.bubbleWrapper, animatedStyle]}>
                    <TouchableWithoutFeedback onPress={handlePress}>
                        <View>
                            {isMine ? (
                                <GlassCard
                                    intensity={50}
                                    tint={themeMode === 'dark' ? 'dark' : 'light'}
                                    style={[styles.bubble, styles.mine]}
                                    noBorder={true}
                                >
                                    <LinearGradient
                                        colors={['rgba(139, 92, 246, 0.45)', 'rgba(217, 70, 239, 0.6)']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={StyleSheet.absoluteFill}
                                    />
                                    <View style={[StyleSheet.absoluteFill, { borderRadius: 18, borderBottomRightRadius: 4 }]} />
                                    <View style={{ position: 'relative', zIndex: 1 }}>
                                        {renderContent()}
                                    </View>
                                </GlassCard>
                            ) : (
                                <GlassCard intensity={25} tint={themeMode === 'dark' ? 'dark' : 'light'} style={[styles.bubble, styles.theirs]} noBorder={true}>
                                    <View style={[StyleSheet.absoluteFill, { borderRadius: 18, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 4 }]} />
                                    <View style={{ position: 'relative', zIndex: 1 }}>
                                        {renderContent()}
                                    </View>
                                </GlassCard>
                            )}

                            {reacted && (
                                <Animated.View 
                                    style={[
                                        styles.reactionBadge,
                                        badgeAnimatedStyle,
                                        {
                                            right: isMine ? undefined : -10, // Pushed further out
                                            left: isMine ? -10 : undefined,   // Pushed further out
                                            backgroundColor: themeMode === 'dark' ? '#1f2937' : '#ffffff',
                                            borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                        }
                                    ]}
                                >
                                    <TouchableOpacity 
                                        activeOpacity={0.7}
                                        onPress={() => onReaction && onReaction(null)}
                                        style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
                                    >
                                        {reaction === 'heart' && <HeartBurst count={6} color="#ff5e95" />}
                                        <Text style={{ fontSize: 10 }}>{getEmojiIcon(reaction)}</Text>
                                    </TouchableOpacity>
                                </Animated.View>
                            )}
                        </View>
                    </TouchableWithoutFeedback>

                    {!isMine && isReplied && parseFloat(earnedDiamonds) > 0 && (
                        <View style={styles.earningBadge}>
                            <Ionicons name="checkmark-circle" size={10} color="#10b981" />
                            <Text style={styles.earningBadgeText}>
                                Yanıtlandı (+{parseFloat(earnedDiamonds)} Elmas)
                            </Text>
                        </View>
                    )}

                    {!isMine && !isReplied && isOperator && (
                        <View style={styles.earningBadge}>
                            <Ionicons name="sparkles" size={10} color="#eab308" />
                            <Text style={[styles.earningBadgeText, { color: '#eab308' }]}>
                                Yanıtla ve 43.5 Elmas kazan
                            </Text>
                        </View>
                    )}

                    {showPicker && (
                        <View style={[styles.pickerContainer, isMine ? { left: 0 } : { right: 0 }]}>
                            <GlassCard intensity={80} tint="dark" style={styles.pickerGlass}>
                                <View style={styles.pickerRow}>
                                    {REACTION_EMOJIS.map((emoji) => (
                                        <TouchableOpacity 
                                            key={emoji.type} 
                                            onPress={() => handleEmojiSelect(emoji.type === reaction ? null : emoji.type)}
                                            style={[styles.emojiBtn, reaction === emoji.type && styles.emojiBtnSelected]}
                                        >
                                            <Text style={styles.emojiText}>{emoji.icon}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </GlassCard>
                        </View>
                    )}
                </Animated.View>

                {!isMine && (
                    <TouchableOpacity 
                        style={styles.reactionTrigger} 
                        onPress={() => setShowPicker(!showPicker)}
                        activeOpacity={0.6}
                    >
                        <Ionicons name="happy-outline" size={18} color="rgba(255,255,255,0.3)" />
                    </TouchableOpacity>
                )}
            </View>

            {isMine && (
                <View style={[styles.avatarWrapper, styles.avatarRight]}>
                    <VipFrame
                        level={vipLevel}
                        avatar={avatar}
                        size={35}
                        isStatic={true}
                    />
                </View>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginVertical: 2,
        paddingHorizontal: 4,
    },
    containerMine: {
        justifyContent: 'flex-end',
    },
    containerTheirs: {
        justifyContent: 'flex-start',
    },
    bubbleAndActions: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    bubbleWrapper: {
        maxWidth: '85%',
        position: 'relative',
    },
    reactionTrigger: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerContainer: {
        position: 'absolute',
        top: -45,
        zIndex: 100,
        minWidth: 200,
    },
    pickerGlass: {
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    emojiBtn: {
        padding: 5,
        borderRadius: 10,
    },
    emojiBtnSelected: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    emojiText: {
        fontSize: 20,
    },
    bubble: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 18,
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
        bottom: -12,
        borderRadius: 10,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderWidth: 1,
        zIndex: 10,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        justifyContent: 'center',
        alignItems: 'center',
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
        fontSize: 9,
        fontWeight: '600',
    },
    timeMine: {
        color: '#ffffff',
        opacity: 0.8,
    },
    timeTheirs: {
    },
    earningBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        alignSelf: 'flex-start',
    },
    earningBadgeText: {
        color: '#10b981',
        fontSize: 8.5,
        fontWeight: 'bold',
        marginLeft: 3,
    },
});

export default MessageBubble;
