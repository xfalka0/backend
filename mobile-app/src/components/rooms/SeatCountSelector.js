import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const SEAT_OPTIONS = [4, 8, 12, 16];

export default function SeatCountSelector({ selectedSeats, onSelectSeats }) {
    return (
        <View style={styles.container}>
            <Text style={styles.label}>Koltuk Sayısı</Text>
            
            <View style={styles.optionsRow}>
                {SEAT_OPTIONS.map((count) => {
                    const isSelected = selectedSeats === count;
                    
                    if (isSelected) {
                        return (
                            <TouchableOpacity 
                                key={count} 
                                style={styles.optionWrapper}
                                activeOpacity={0.9}
                            >
                                <LinearGradient
                                    colors={['#8b5cf6', '#ec4899']}
                                    style={styles.activeOption}
                                >
                                    <Ionicons name="people" size={18} color="#FFF" />
                                    <Text style={styles.activeText}>{count} Koltuk</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={count}
                            style={styles.option}
                            onPress={() => onSelectSeats(count)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="people-outline" size={18} color="#9DA3B8" />
                            <Text style={styles.optionText}>{count} Koltuk</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 30,
    },
    label: {
        color: '#9DA3B8',
        fontSize: 13,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    optionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    optionWrapper: {
        flex: 1,
        minWidth: '45%',
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 2,
    },
    activeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 6,
    },
    activeText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14.5,
    },
    option: {
        flex: 1,
        minWidth: '45%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 18,
        gap: 6,
    },
    optionText: {
        color: '#9DA3B8',
        fontWeight: '600',
        fontSize: 14.5,
    },
});
