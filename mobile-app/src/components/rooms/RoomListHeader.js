import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RoomListHeader({ activeTab, onTabChange, onBack, insets }) {
    return (
        <View style={[styles.header, { paddingTop: insets?.top || 50 }]}>
            {/* Geri Butonu */}
            <TouchableOpacity 
                onPress={onBack} 
                style={styles.backButton}
                activeOpacity={0.8}
            >
                <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Ortadaki Takip et / Parti Tabları */}
            <View style={styles.mainTabsContainer}>
                {['Takip et', 'Parti'].map(tab => {
                    const isActive = activeTab === tab;
                    return (
                        <TouchableOpacity
                            key={tab}
                            style={styles.mainTabItem}
                            onPress={() => onTabChange(tab)}
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                styles.mainTabText,
                                isActive && styles.mainTabTextActive
                            ]}>
                                {tab}
                            </Text>
                            {isActive && (
                                <View style={styles.mainTabIndicator} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
            
            {/* Sağdaki Ödül / Sıralama İkonu */}
            <TouchableOpacity style={styles.rewardButton} activeOpacity={0.8}>
                <Ionicons name="ribbon" size={20} color="#FFD700" style={styles.iconGlow} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: 'transparent',
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    mainTabsContainer: {
        flexDirection: 'row',
        gap: 24,
    },
    mainTabItem: {
        alignItems: 'center',
        paddingVertical: 4,
    },
    mainTabText: {
        fontSize: 15.5,
        color: '#9DA3B8',
        fontWeight: 'bold',
    },
    mainTabTextActive: {
        color: '#20E070', // Accent Green neon color matching request
    },
    mainTabIndicator: {
        width: 14,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#20E070', // Accent Green indicator
        marginTop: 4,
        shadowColor: '#20E070',
        shadowOpacity: 0.8,
        shadowRadius: 3,
        elevation: 2,
    },
    rewardButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    iconGlow: {
        textShadowColor: '#FFC83D',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 4,
    },
});
