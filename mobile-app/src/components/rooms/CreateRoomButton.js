import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function CreateRoomButton({ onPress, loading }) {
    return (
        <TouchableOpacity 
            style={styles.btn} 
            onPress={onPress} 
            disabled={loading}
            activeOpacity={0.8}
        >
            <LinearGradient
                colors={['#8b5cf6', '#ec4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradient}
            >
                {loading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                ) : (
                    <>
                        <Ionicons name="play-outline" size={20} color="#FFF" style={styles.icon} />
                        <Text style={styles.text}>Odayı Başlat</Text>
                    </>
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
        elevation: 4,
        marginBottom: 20,
    },
    gradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 16,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    icon: {
        marginRight: 6,
    },
});
