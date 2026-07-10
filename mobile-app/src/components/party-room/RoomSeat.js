import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import VipFrame from '../ui/VipFrame';

function formatGiftPoints(value) {
    if (!value || value <= 0) return '0';
    if (value < 1000) return value.toString();
    if (value < 10000) {
        const val = value / 1000;
        return val.toFixed(1).replace('.0', '') + 'K';
    }
    if (value < 1000000) {
        return Math.floor(value / 1000) + 'K';
    }
    const val = value / 1000000;
    return val.toFixed(1).replace('.0', '') + 'M';
}

const cleanUsername = (name) => {
    if (!name) return '';
    let cleaned = name.replace(/^op_/i, '');
    cleaned = cleaned.replace(/_\d+(-\d+)?$/g, '');
    if (name.toLowerCase().startsWith('op_') && cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return cleaned;
};

export default function RoomSeat({ seat, currentUserId, onPress, isHost }) {
    const isOccupied = !!seat.user_id;
    const isMe = isOccupied && seat.user_id?.toString() === currentUserId?.toString();
    const isSpeaking = seat.is_speaking; 
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const ripple1 = useRef(new Animated.Value(0)).current;
    const ripple2 = useRef(new Animated.Value(0)).current;

    // Points Animation State
    const prevPointsRef = useRef(seat.room_gift_points || 0);
    const [pointsDiff, setPointsDiff] = useState(null);
    const floatAnim = useRef(new Animated.Value(0)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    // Reaction Animation State
    const [visibleReaction, setVisibleReaction] = useState(null);
    const reactionAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (seat.activeReaction) {
            setVisibleReaction(seat.activeReaction.emoji);
            reactionAnim.setValue(0);
            Animated.timing(reactionAnim, {
                toValue: 1,
                duration: 2200,
                useNativeDriver: true
            }).start((res) => {
                if (res.finished) {
                    setVisibleReaction(null);
                }
            });
        }
    }, [seat.activeReaction]);

    useEffect(() => {
        if (isSpeaking) {
            const pulseLoop = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                ])
            );

            const ripple1Loop = Animated.loop(
                Animated.timing(ripple1, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                })
            );
            
            const ripple2Loop = Animated.loop(
                Animated.sequence([
                    Animated.delay(750),
                    Animated.timing(ripple2, {
                        toValue: 1,
                        duration: 1500,
                        useNativeDriver: true,
                    })
                ])
            );

            pulseLoop.start();
            ripple1Loop.start();
            ripple2Loop.start();

            return () => {
                pulseLoop.stop();
                ripple1Loop.stop();
                ripple2Loop.stop();
                pulseAnim.setValue(1);
                ripple1.setValue(0);
                ripple2.setValue(0);
            };
        } else {
            pulseAnim.setValue(1);
            ripple1.setValue(0);
            ripple2.setValue(0);
        }
    }, [isSpeaking]);

    useEffect(() => {
        const currentPoints = seat.room_gift_points || 0;
        const prevPoints = prevPointsRef.current;
        if (currentPoints > prevPoints) {
            const diff = currentPoints - prevPoints;
            setPointsDiff(diff);
            
            // Trigger floating animation
            floatAnim.setValue(0);
            Animated.timing(floatAnim, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true
            }).start(() => setPointsDiff(null));

            // Trigger glow animation
            glowAnim.setValue(0);
            Animated.sequence([
                Animated.timing(glowAnim, { toValue: 1, duration: 250, useNativeDriver: false }),
                Animated.timing(glowAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
            ]).start();
        }
        prevPointsRef.current = currentPoints;
    }, [seat.room_gift_points]);

    const badgeScale = glowAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 1.15, 1]
    });

    return (
        <TouchableOpacity 
            style={styles.seatCell} 
            onPress={() => onPress(seat)} 
            activeOpacity={0.85}
        >
            {/* Absolute container for the seat circle to prevent grid layout shifting */}
            <View style={styles.avatarWrapper}>
                {isSpeaking && (
                    <>
                        <Animated.View style={[styles.ripple, {
                            transform: [{
                                scale: ripple1.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 1.7]
                                })
                            }],
                            opacity: ripple1.interpolate({
                                inputRange: [0, 0.8, 1],
                                outputRange: [0.6, 0.4, 0]
                            })
                        }]} />
                        <Animated.View style={[styles.ripple, {
                            transform: [{
                                scale: ripple2.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 1.7]
                                })
                            }],
                            opacity: ripple2.interpolate({
                                inputRange: [0, 0.8, 1],
                                outputRange: [0.6, 0.4, 0]
                            })
                        }]} />
                    </>
                )}
                <Animated.View style={{ transform: [{ scale: isSpeaking ? pulseAnim : 1 }] }}>
                    {isOccupied ? (
                        <View style={styles.seatOccupied}>
                            {(!seat.vip_level || seat.vip_level === 0) ? (
                                <LinearGradient
                                    colors={['#ffd700', '#db2777']} // Gold to vibrant pink gradient border
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.gradientBorderContainer}
                                >
                                    <View style={styles.innerAvatarContainer}>
                                        <VipFrame
                                            level={seat.vip_level || 0}
                                            avatar={seat.avatar_url}
                                            size={44}
                                            isStatic
                                        />
                                    </View>
                                </LinearGradient>
                            ) : (
                                <VipFrame
                                    level={seat.vip_level || 0}
                                    avatar={seat.avatar_url}
                                    size={48}
                                    isStatic
                                />
                            )}
                            {/* Mic status badge */}
                            {seat.is_muted && (
                                <View style={styles.muteBadge}>
                                    <Ionicons name="mic-off" size={9} color="#fff" />
                                </View>
                            )}
                            {/* Active speaking neon ring */}
                            {isSpeaking && <View style={styles.speakingRing} />}
                        </View>
                    ) : (
                        <View style={[
                            styles.emptySeat, 
                            seat.is_locked && styles.lockedSeat,
                            isHost && styles.hostEmptySeat
                        ]}>
                            <Ionicons
                                name={seat.is_locked ? 'lock-closed' : 'mic-outline'}
                                size={18}
                                color={seat.is_locked ? '#ff007f' : 'rgba(255,255,255,0.75)'}
                            />
                        </View>
                    )}
                </Animated.View>

                {/* Floating Points Difference Indicator */}
                {pointsDiff !== null && (
                    <Animated.View style={[
                        styles.floatingDiffContainer,
                        {
                            opacity: floatAnim.interpolate({
                                inputRange: [0, 0.15, 0.85, 1],
                                outputRange: [0, 1, 1, 0]
                            }),
                            transform: [
                                {
                                    translateY: floatAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [5, -45]
                                    })
                                }
                            ]
                        }
                    ]}>
                        <Text style={styles.floatingDiffText}>+{pointsDiff}</Text>
                    </Animated.View>
                )}

                {/* Floating Reaction Emoji */}
                {visibleReaction !== null && (
                    <Animated.View style={[
                        styles.floatingReactionContainer,
                        {
                            opacity: reactionAnim.interpolate({
                                inputRange: [0, 0.15, 0.85, 1],
                                outputRange: [0, 1, 1, 0]
                            }),
                            transform: [
                                {
                                    scale: reactionAnim.interpolate({
                                        inputRange: [0, 0.15, 0.85, 1],
                                        outputRange: [0.3, 1.1, 1.1, 0.3]
                                    })
                                }
                            ]
                        }
                    ]}>
                        <Text style={[
                            styles.floatingReactionText,
                            visibleReaction.endsWith('_right') && { transform: [{ scaleX: -1 }] }
                        ]}>
                            {visibleReaction.endsWith('_right') ? visibleReaction.replace('_right', '') : visibleReaction}
                        </Text>
                    </Animated.View>
                )}
            </View>

            {/* Gift points badge positioned exactly below the avatar without overlapping, absolute position */}
            {isOccupied && (
                <Animated.View style={[
                    styles.giftPointBadgeContainer,
                    {
                        transform: [{ scale: badgeScale }]
                    }
                ]}>
                    <LinearGradient
                        colors={['#5b21b6', '#db2777']} // Deep violet to pink gradient
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.giftPointGradient}
                    >
                        <Text style={styles.giftPointText}>
                            {formatGiftPoints(seat.room_gift_points || 0)}
                        </Text>
                    </LinearGradient>
                </Animated.View>
            )}

            {/* Username Row, absolute position */}
            <View style={styles.nameRow}>
                <Text style={styles.seatName} numberOfLines={1}>
                    {isOccupied ? (cleanUsername(seat.display_name || seat.username) || 'Katılımcı') : seat.seat_number}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    seatCell: {
        width: 72,
        height: 80,
        alignItems: 'center',
        justifyContent: 'flex-start',
        position: 'relative',
        marginVertical: 4,
    },
    avatarWrapper: {
        position: 'absolute',
        top: 0,
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    seatOccupied: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    gradientBorderContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        padding: 1.2, // Frame border width peeking out
        alignItems: 'center',
        justifyContent: 'center',
    },
    innerAvatarContainer: {
        width: 45.6,
        height: 45.6,
        borderRadius: 22.8,
        backgroundColor: '#070B24', // Koyu premium background
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    ripple: {
        position: 'absolute',
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: '#00f3ff',
        backgroundColor: 'rgba(0, 243, 255, 0.08)',
        zIndex: -1,
    },
    speakingRing: {
        position: 'absolute',
        top: -3,
        left: -3,
        right: -3,
        bottom: -3,
        borderRadius: 27,
        borderWidth: 1.5,
        borderColor: '#00f3ff',
        shadowColor: '#00f3ff',
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    muteBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.2,
        borderColor: '#070B24',
        zIndex: 10,
    },
    emptySeat: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderWidth: 1.2,
        borderColor: 'rgba(255,255,255,0.38)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lockedSeat: {
        backgroundColor: 'rgba(255,0,127,0.08)',
        borderColor: '#ff007f',
    },
    hostEmptySeat: {
        borderColor: 'rgba(0, 243, 255, 0.45)',
    },
    giftPointBadgeContainer: {
        position: 'absolute',
        top: 42, // Positioned exactly to overlap the bottom edge of 48px avatar (centered on Y=42)
        alignSelf: 'center',
        zIndex: 10,
        shadowColor: '#db2777',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 1.5,
        elevation: 2,
    },
    giftPointGradient: {
        width: 42,
        height: 14,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.8,
        borderColor: 'rgba(255, 215, 0, 0.4)', // Premium light gold border
    },
    giftPointText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#ffffff',
        textAlign: 'center',
        lineHeight: 12,
    },
    floatingDiffContainer: {
        position: 'absolute',
        top: 0,
        alignSelf: 'center',
        backgroundColor: 'rgba(255, 77, 141, 0.95)',
        borderColor: '#fff',
        borderWidth: 0.5,
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 1,
        zIndex: 99,
    },
    floatingDiffText: {
        color: '#fff',
        fontSize: 8.5,
        fontWeight: '900',
    },
    nameRow: {
        position: 'absolute',
        top: 60, // Fixed Y-coordinate for username/number across all seats
        width: 72,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    seatName: {
        fontSize: 9.5,
        color: 'rgba(255,255,255,0.85)',
        fontWeight: '600',
        textAlign: 'center',
        maxWidth: 54,
    },
    floatingReactionContainer: {
        position: 'absolute',
        top: 3,
        alignSelf: 'center',
        zIndex: 100,
    },
    floatingReactionText: {
        fontSize: 34,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1.5 },
        textShadowRadius: 3,
    },
});
