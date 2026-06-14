import React from 'react';
import { StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CreateRoomFloatingButton({ onPress }) {
    const insets = useSafeAreaInsets();
    
    return (
        <TouchableOpacity
            style={[styles.fabWrapper, { bottom: Math.max(insets.bottom + 12, 24) }]}
            activeOpacity={0.88}
            onPress={onPress}
        >
            <LinearGradient
                colors={['#FF3F86', '#FF8A00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fabGradient}
            >
                <Ionicons name="add" size={18} color="#fff" style={styles.icon} />
                <Text style={styles.fabText}>Oda Oluştur</Text>
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    fabWrapper: {
        position: 'absolute',
        right: 18,
        borderRadius: 28,
        shadowColor: '#FF3F86',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 8,
        overflow: 'visible',
        zIndex: 999,
    },
    fabGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 22,
        paddingVertical: 12,
        borderRadius: 28,
    },
    icon: {
        marginRight: 4,
        fontWeight: '900',
    },
    fabText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});
