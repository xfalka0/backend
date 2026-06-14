import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VipFrame from '../ui/VipFrame';

export default function RoomSeat({ seat, currentUserId, onPress, isHost }) {
    const isOccupied = !!seat.user_id;
    const isMe = isOccupied && seat.user_id?.toString() === currentUserId?.toString();
    const isSpeaking = seat.is_speaking; 
    const pulseAnim = useRef(new Animated.Value(1)).current;

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

    return (
        <TouchableOpacity 
            style={styles.seatCell} 
            onPress={() => onPress(seat)} 
            activeOpacity={0.85}
        >
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
    seatName: {
        marginTop: 4,
        fontSize: 9.5,
        color: 'rgba(255,255,255,0.85)',
        fontWeight: 'bold',
        textAlign: 'center',
        width: 54,
    },
});
