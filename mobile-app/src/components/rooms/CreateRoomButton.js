import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function CreateRoomButton({ onPress, loading }) {
    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
    };

    return (
        <TouchableOpacity 
            style={styles.btn} 
            onPress={handlePress} 
            disabled={loading}
            activeOpacity={0.85}
        >
            <LinearGradient
                colors={['#a855f7', '#ec4899', '#f43f5e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradient}
            >
                {loading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                ) : (
                    <View style={styles.contentRow}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="mic" size={16} color="#FFF" />
                        </View>
                        <Text style={styles.text}>Odayı Başlat</Text>
                        <Ionicons name="sparkles" size={16} color="rgba(255,255,255,0.9)" />
                    </View>
                )}
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    btn: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 6,
        marginTop: 10,
        marginBottom: 10,
    },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    iconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 16,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
});
