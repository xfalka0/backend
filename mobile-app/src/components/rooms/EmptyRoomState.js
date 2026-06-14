import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function EmptyRoomState({ roomCount, onCreatePress }) {
    if (roomCount === 0) {
        return (
            <View style={styles.emptyContainer}>
                <View style={styles.iconCircle}>
                    <Ionicons name="chatbubbles-outline" size={44} color="#FF3F86" />
                </View>
                <Text style={styles.titleText}>Henüz aktif oda yok</Text>
                <Text style={styles.subtitleText}>İlk sohbet odasını sen başlat ve arkadaşlarını davet et!</Text>

                <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={onCreatePress}
                    activeOpacity={0.85}
                >
                    <LinearGradient
                        colors={['#FF3F86', '#ec4899']}
                        style={styles.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <Text style={styles.actionText}>Oda Oluştur 🎙️</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        );
    }

    if (roomCount === 1) {
        return (
            <LinearGradient
                colors={['rgba(255, 63, 134, 0.08)', 'rgba(0, 229, 255, 0.03)']}
                style={styles.suggestionBanner}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.starsOverlay}>
                    <Ionicons name="sparkles" size={14} color="#FFD700" style={styles.sparkleLeft} />
                    <Ionicons name="star" size={8} color="#00E5FF" style={styles.sparkleRight} />
                </View>
                <View style={styles.bannerContent}>
                    <Ionicons name="rocket-outline" size={20} color="#00E5FF" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.bannerTitle}>Oda mı bulamadın?</Text>
                        <Text style={styles.bannerSubtitle}>Yeni odalar oluşturup insanları davet edebilirsin!</Text>
                    </View>
                </View>
            </LinearGradient>
        );
    }

    return null;
}

const styles = StyleSheet.create({
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
        paddingHorizontal: 24,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 63, 134, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 63, 134, 0.15)',
    },
    titleText: {
        fontSize: 16.5,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    subtitleText: {
        fontSize: 12.5,
        color: '#9DA3B8',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 24,
        paddingHorizontal: 16,
    },
    actionButton: {
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#FF3F86',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    gradient: {
        paddingHorizontal: 24,
        paddingVertical: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 13,
    },
    suggestionBanner: {
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 16,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 63, 134, 0.12)',
        position: 'relative',
        overflow: 'hidden',
    },
    starsOverlay: {
        position: 'absolute',
        top: 0,
        right: 0,
        left: 0,
        bottom: 0,
        pointerEvents: 'none',
    },
    sparkleLeft: {
        position: 'absolute',
        top: 6,
        right: 18,
        opacity: 0.7,
    },
    sparkleRight: {
        position: 'absolute',
        bottom: 8,
        right: 42,
        opacity: 0.5,
    },
    bannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bannerTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 2,
    },
    bannerSubtitle: {
        fontSize: 11,
        color: '#9DA3B8',
    },
});
