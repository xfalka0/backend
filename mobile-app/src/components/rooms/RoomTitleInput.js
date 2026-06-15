import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';

export default function RoomTitleInput({ value, onChangeText, maxLength = 40 }) {
    return (
        <View style={styles.container}>
            <View style={styles.labelRow}>
                <Text style={styles.label}>Oda Başlığı</Text>
                <Text style={styles.charCount}>{value.length}/{maxLength}</Text>
            </View>

            <TextInput
                placeholder="Odanız için çekici bir başlık yazın..."
                placeholderTextColor="rgba(255, 255, 255, 0.35)"
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                maxLength={maxLength}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 20,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        color: '#9DA3B8',
        fontSize: 13,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    charCount: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 14,
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '500',
    },
});
