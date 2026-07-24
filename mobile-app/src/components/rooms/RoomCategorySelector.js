import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const CATEGORIES = [
    { id: 'chat', label: 'Sohbet', icon: '💬' },
    { id: 'love', label: 'Aşk & Uyum', icon: '💖' },
    { id: 'music', label: 'Müzik', icon: '🎵' },
    { id: 'games', label: 'Oyun', icon: '🎮' },
    { id: 'fun', label: 'Eğlence', icon: '🎉' },
];

export default function RoomCategorySelector({ selectedCategory, onSelectCategory }) {
    const handleSelect = (catId) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSelectCategory(catId);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>KATEGORİ SEÇİMİ</Text>
            
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    
                    if (isSelected) {
                        return (
                            <TouchableOpacity 
                                key={cat.id} 
                                style={styles.pillWrapper}
                                activeOpacity={0.9}
                            >
                                <LinearGradient
                                    colors={['#a855f7', '#ec4899']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.activePill}
                                >
                                    <Text style={styles.activeIcon}>{cat.icon}</Text>
                                    <Text style={styles.activeLabel}>{cat.label}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        );
                    }

                    return (
                        <TouchableOpacity
                            key={cat.id}
                            style={styles.pill}
                            onPress={() => handleSelect(cat.id)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.pillIcon}>{cat.icon}</Text>
                            <Text style={styles.pillLabel}>{cat.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 24,
    },
    label: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.2,
        marginBottom: 10,
    },
    scrollContent: {
        gap: 8,
        paddingRight: 20,
    },
    pillWrapper: {
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    activePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 6,
    },
    activeIcon: {
        fontSize: 14,
    },
    activeLabel: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 13,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.07)',
        borderRadius: 18,
        gap: 6,
    },
    pillIcon: {
        fontSize: 14,
    },
    pillLabel: {
        color: '#94A3B8',
        fontWeight: '700',
        fontSize: 13,
    },
});
