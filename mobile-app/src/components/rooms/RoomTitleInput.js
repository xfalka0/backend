import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RoomTitleInput({ value, onChangeText, maxLength = 40 }) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View style={styles.container}>
            <View style={styles.labelRow}>
                <Text style={styles.label}>ODA BAŞLIĞI</Text>
                <Text style={[styles.charCount, value.length >= maxLength && styles.charCountFull]}>
                    {value.length}/{maxLength}
                </Text>
            </View>

            <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}>
                <Ionicons 
                    name="mic" 
                    size={18} 
                    color={isFocused ? "#ec4899" : "#64748B"} 
                    style={styles.inputIcon} 
                />
                <TextInput
                    placeholder="Örn: Gece Sohbetleri & Müzik 🎶"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    style={styles.input}
                    value={value}
                    onChangeText={onChangeText}
                    maxLength={maxLength}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
            </View>
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
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.2,
    },
    charCount: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '700',
    },
    charCountFull: {
        color: '#ef4444',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 18,
        paddingHorizontal: 14,
        height: 52,
    },
    inputWrapperFocused: {
        borderColor: '#ec4899',
        backgroundColor: 'rgba(236, 72, 153, 0.04)',
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 14.5,
        fontWeight: '600',
        height: '100%',
    },
});
