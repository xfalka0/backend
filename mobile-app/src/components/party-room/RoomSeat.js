import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

export default function RoomSeat({ seat, currentUserId, onPress, isHost }) {
    const isOccupied = !!seat.user_id;
    const isMe = isOccupied && seat.user_id?.toString() === currentUserId?.toString();
    const isSpeaking = seat.is_speaking; 
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Points Animation State
    const prevPointsRef = useRef(seat.room_gift_points || 0);
    const [pointsDiff, setPointsDiff] = useState(null);
    const floatAnim = useRef(new Animated.Value(0)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isSpeaking) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.stopAnimation();
            pulseAnim.setValue(1);
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

    const badgeBorderColor = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(255, 210, 90, 0.6)', '#FF4D8D']
    });

    return (
        <TouchableOpacity 
            style={styles.seatCell} 
            onPress={() => onPress(seat)} 
            activeOpacity={0.85}
        >
            <View style={{ position: 'relative' }}>
                <Animated.View style={{ transform: [{ scale: isSpeaking ? pulseAnim : 1 }] }}>
                    {isOccupied ? (
                        <View style={styles.seatOccupied}>
                            <VipFrame
                                level={seat.vip_level || 0}
                                avatar={seat.avatar_url}
                                size={48}
                                isStatic
                            />
                            {/* Mic status badge */}
                            {seat.is_muted && (
                                <View style={styles.muteBadge}>
                                    <Ionicons name="mic-off" size={6} color="#fff" />
                                </View>
                            )}
                            {/* Active speaking neon ring */}
                            {isSpeaking && <View style={styles.speakingRing} />}
                            
                            {/* VIP or Seat rating label */}
                            <View style={styles.vipBadge}>
                                <Text style={styles.vipText}>
                                    {seat.vip_level ? `${seat.vip_level}` : `Lv.${seat.level || 1}`}
                                </Text>
                            </View>
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
            </View>

            {/* Gift points badge under avatar */}
            {isOccupied && (
                <Animated.View style={[
                    styles.giftPointBadge,
                    {
                        borderColor: badgeBorderColor,
                        transform: [{ scale: badgeScale }]
                    }
                ]}>
                    <Text style={styles.giftPointText}>
                        {formatGiftPoints(seat.room_gift_points || 0)}
                    </Text>
                </Animated.View>
            )}

            <Text style={styles.seatName} numberOfLines={1}>
                {isOccupied ? (seat.display_name || seat.username || 'Katılımcı') : seat.seat_number}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    seatCell: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 72,
        marginVertical: 6,
    },
    seatOccupied: {
        width: 50,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    speakingRing: {
        position: 'absolute',
        top: -3,
        left: -3,
        right: -3,
        bottom: -3,
        borderRadius: 28,
        borderWidth: 1.5,
        borderColor: '#00f3ff',
        shadowColor: '#00f3ff',
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    muteBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#ef4444',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#070B24',
        zIndex: 10,
    },
    vipBadge: {
        position: 'absolute',
        bottom: -4,
        backgroundColor: 'rgba(236,72,153,0.95)',
        paddingHorizontal: 3,
        borderRadius: 4,
        borderWidth: 0.5,
        borderColor: '#fff',
    },
    vipText: {
        fontSize: 6.5,
        color: '#fff',
        fontWeight: 'bold',
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
    seatNumberText: {
        fontSize: 7.5,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 0.5,
    },
    giftPointBadge: {
        minWidth: 42,
        height: 15,
        borderRadius: 7.5,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 10, 35, 0.85)',
        borderWidth: 1,
        marginTop: 6,
    },
    giftPointText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#FFD75A',
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
    seatName: {
        marginTop: 4,
        fontSize: 9.5,
        color: 'rgba(255,255,255,0.85)',
        fontWeight: 'bold',
        textAlign: 'center',
        width: 54,
    },
});
