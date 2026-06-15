import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const FEATURED_ITEMS = [
    { id: 'popular', label: 'Popüler', icon: '🏆', badge: 'HOT' },
    { id: 'vip', label: 'VIP Parti', icon: '🔥', badge: 'XP' },
    { id: 'new', label: 'Yeni Odalar', icon: '✨', badge: 'NEW' },
    { id: 'tr', label: 'Türkiye', icon: '🇹🇷', badge: 'TR' },
    { id: 'chat', label: 'Sohbet', icon: '💬', badge: 'TALK' },
];

export default function FeaturedRoomChips({ activeChip, onChipChange }) {
    return (
        <View style={styles.container}>
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {FEATURED_ITEMS.map((item) => {
                    const isActive = activeChip === item.id;
                    
                    if (isActive) {
                        return (
                            <TouchableOpacity 
                                key={item.id}
                                style={styles.activeWrapper}
                                activeOpacity={0.9}
                            >
                                <LinearGradient
                                    colors={['#FF2F8B', '#7B2CFF']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.activeChip}
                                >
                                    <Text style={styles.icon}>{item.icon}</Text>
                                    <Text style={styles.activeText}>{item.label}</Text>
                                    <View style={styles.badgeActive}>
                                        <Text style={styles.badgeTextActive}>{item.badge}</Text>
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.chip}
                            onPress={() => onChipChange(item.id)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.icon}>{item.icon}</Text>
                            <Text style={styles.text}>{item.label}</Text>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{item.badge}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 10,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingRight: 24, // extra padding to avoid clipping on right end
        gap: 12, // 12px gap between chips
        alignItems: 'center',
    },
    activeWrapper: {
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#FF2F8B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    activeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        gap: 5,
    },
    activeText: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: 'bold',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 14,
        gap: 5,
    },
    text: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
    },
    icon: {
        fontSize: 13,
    },
    badgeActive: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    badgeTextActive: {
        color: '#FF2F8B',
        fontSize: 7.5,
        fontWeight: '900',
    },
    badge: {
        backgroundColor: 'rgba(255, 63, 134, 0.12)',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    badgeText: {
        color: '#FF2F8B',
        fontSize: 7.5,
        fontWeight: '900',
    },
});
