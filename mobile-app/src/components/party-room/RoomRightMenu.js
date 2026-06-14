import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RoomRightMenu({ onToggleFavorite, onOpenTasks, onOpenRankings, onOpenBonus }) {
    return (
        <View style={styles.menuContainer}>
            {/* 1. Tasks / Game Button */}
            <TouchableOpacity style={styles.menuBtn} onPress={onOpenBonus}>
                <View style={styles.innerCircle}>
                    <Ionicons name="game-controller-sharp" size={12} color="#ff007f" />
                </View>
                <Text style={styles.btnLabel}>Oyun</Text>
            </TouchableOpacity>

            {/* 2. Super Reward / Prize */}
            <TouchableOpacity style={[styles.menuBtn, styles.specialBtn]} onPress={onOpenTasks}>
                <Ionicons name="gift-sharp" size={14} color="#ffd700" />
                <Text style={styles.specialLabel}>Ödül</Text>
            </TouchableOpacity>

            {/* 3. Control button (Ctrl) */}
            <TouchableOpacity style={styles.ctrlBtn} onPress={onOpenRankings}>
                <Text style={styles.ctrlText}>Ctrl</Text>
            </TouchableOpacity>

            {/* 4. Slot / Fortune wheel */}
            <TouchableOpacity style={styles.menuBtn} onPress={onToggleFavorite}>
                <Ionicons name="color-wand-sharp" size={12} color="#00f3ff" />
                <Text style={styles.btnLabel}>Çark</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    menuContainer: {
        gap: 6,
        alignItems: 'center',
        marginRight: 2,
        marginBottom: 4,
    },
    menuBtn: {
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: 'rgba(7, 11, 36, 0.75)',
        borderWidth: 0.8,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    innerCircle: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnLabel: {
        fontSize: 6,
        color: '#fff',
        fontWeight: 'bold',
        marginTop: 1,
    },
    specialBtn: {
        borderColor: '#ffd700',
        backgroundColor: 'rgba(255, 215, 0, 0.08)',
    },
    specialLabel: {
        fontSize: 5.5,
        color: '#ffd700',
        fontWeight: 'bold',
    },
    ctrlBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.65)',
        borderWidth: 1,
        borderColor: '#00f3ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctrlText: {
        fontSize: 7.5,
        color: '#00f3ff',
        fontWeight: 'bold',
    },
});
