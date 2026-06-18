import React from 'react';
import { View, StyleSheet, Dimensions, Image, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RoomSeat from './RoomSeat';

const { width } = Dimensions.get('window');

export default function RoomSeatLayout({ seats, currentUserId, onSeatPress, isHost, listeners = [] }) {
    // Pad seats up to 16 seats with real data
    const finalSeats = [];
    for (let i = 1; i <= 16; i++) {
        const storeSeat = seats.find(s => s.seat_number === i);
        if (storeSeat) {
            finalSeats.push(storeSeat);
        } else {
            finalSeats.push({
                seat_number: i,
                room_id: seats[0]?.room_id || '',
                user_id: null,
                is_locked: false,
                is_muted: false
            });
        }
    }

    // Host seat (Seat 1) and 3 rows of 5 participant seats (Seats 2 - 16)
    const hostSeat = finalSeats[0];        // Seat 1 (Host)
    const row1 = finalSeats.slice(1, 6);   // Seats 2 - 6
    const row2 = finalSeats.slice(6, 11);  // Seats 7 - 11
    const row3 = finalSeats.slice(11, 16); // Seats 12 - 16
 
    return (
        <View style={styles.layoutContainer}>
            {/* Host Row (Seat 1 - Center) */}
            <View style={styles.hostRow}>
                {hostSeat && (
                    <RoomSeat
                        seat={hostSeat}
                        currentUserId={currentUserId}
                        onPress={onSeatPress}
                        isHost={isHost}
                    />
                )}
            </View>
 
            {/* Row 1 (Seats 2-6) */}
            <View style={styles.row}>
                {row1.map(seat => (
                    <RoomSeat
                        key={seat.seat_number}
                        seat={seat}
                        currentUserId={currentUserId}
                        onPress={onSeatPress}
                        isHost={isHost}
                    />
                ))}
            </View>
 
            {/* Row 2 (Seats 7-11) */}
            <View style={styles.row}>
                {row2.map(seat => (
                    <RoomSeat
                        key={seat.seat_number}
                        seat={seat}
                        currentUserId={currentUserId}
                        onPress={onSeatPress}
                        isHost={isHost}
                    />
                ))}
            </View>

            {/* Row 3 (Seats 12-16) */}
            <View style={styles.row}>
                {row3.map(seat => (
                    <RoomSeat
                        key={seat.seat_number}
                        seat={seat}
                        currentUserId={currentUserId}
                        onPress={onSeatPress}
                        isHost={isHost}
                    />
                ))}
            </View>

            {/* Listeners list at the bottom right */}
            {listeners && listeners.length > 0 && (
                <View style={styles.listenersContainer}>
                    {listeners.slice(0, 3).map((listener, idx) => (
                        <View 
                            key={listener.user_id || listener.id || idx} 
                            style={[
                                styles.listenerAvatarWrapper,
                                idx > 0 && { marginLeft: -8 } // Overlap effect
                            ]}
                        >
                            {listener.avatar_url ? (
                                <Image source={{ uri: listener.avatar_url }} style={styles.listenerAvatar} />
                            ) : (
                                <View style={styles.listenerAvatarPlaceholder}>
                                    <Text style={styles.listenerPlaceholderText}>
                                        {(listener.display_name || listener.username || 'K').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                        </View>
                    ))}
                    <View style={styles.listenerCountBadge}>
                        <Ionicons name="people" size={10} color="#fff" />
                        <Text style={styles.listenerCountText}>
                            {listeners.length}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    layoutContainer: {
        width: width,
        paddingHorizontal: 8,
        marginVertical: 10,
        gap: 8,
    },
    hostRow: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 4,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        width: '100%',
    },
    listenersContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 24,
        marginTop: 6,
    },
    listenerAvatarWrapper: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#fff',
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        zIndex: 2,
    },
    listenerAvatar: {
        width: '100%',
        height: '100%',
    },
    listenerAvatarPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
        backgroundColor: '#7B2CFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    listenerPlaceholderText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    listenerCountBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 6,
        gap: 2,
        height: 20,
    },
    listenerCountText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
    },
});
