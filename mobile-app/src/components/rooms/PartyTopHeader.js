import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function PartyTopHeader({ activeTab, onTabChange, onBack, insets }) {
    return (
        <View style={[styles.header, { paddingTop: insets?.top || 50 }]}>
            {/* Back Button */}
            <TouchableOpacity 
                onPress={onBack} 
                style={styles.backButton}
                activeOpacity={0.8}
            >
                <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Middle Main Tabs (Follow / Party) */}
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
                                <LinearGradient
                                    colors={['#21F58B', '#00D5FF']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.mainTabIndicator}
                                />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
            
            {/* Right Rewards/Ranking Icon */}
            <TouchableOpacity style={styles.rewardButton} activeOpacity={0.8}>
                <Ionicons name="trophy-outline" size={18} color="#FF9B3D" />
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
        paddingBottom: 10,
        backgroundColor: 'transparent',
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    mainTabsContainer: {
        flexDirection: 'row',
        gap: 20,
    },
    mainTabItem: {
        alignItems: 'center',
        paddingVertical: 4,
    },
    mainTabText: {
        fontSize: 15.5,
        color: 'rgba(255, 255, 255, 0.55)',
        fontWeight: '600',
    },
    mainTabTextActive: {
        color: '#21F58B', 
        fontWeight: '700',
        textShadowColor: 'rgba(33, 245, 139, 0.4)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
    },
    mainTabIndicator: {
        width: 16,
        height: 3,
        borderRadius: 1.5,
        marginTop: 4,
    },
    rewardButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
});
