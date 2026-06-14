import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import RoomSeat from './RoomSeat';

const { width } = Dimensions.get('window');

export default function RoomSeatLayout({ seats, currentUserId, onSeatPress, isHost }) {
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
});
