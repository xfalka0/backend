import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const CATEGORIES = [
    { id: 'chat', label: 'Sohbet', icon: '💬' },
    { id: 'love', label: 'Aşk & Uyum', icon: '💖' },
    { id: 'music', label: 'Müzik', icon: '🎵' },
    { id: 'games', label: 'Oyun', icon: '🎮' },
    { id: 'fun', label: 'Eğlence', icon: '🎉' },
];

export default function RoomCategorySelector({ selectedCategory, onSelectCategory }) {
    return (
        <View style={styles.container}>
            <Text style={styles.label}>Kategori Seçimi</Text>
            
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
                                    colors={['#8b5cf6', '#ec4899']}
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
                            onPress={() => onSelectCategory(cat.id)}
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
        marginBottom: 20,
    },
    label: {
        color: '#9DA3B8',
        fontSize: 13,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    scrollContent: {
        gap: 10,
        paddingRight: 20,
    },
    pillWrapper: {
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 2,
    },
    activePill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 6,
    },
    activeIcon: {
        fontSize: 15,
    },
    activeLabel: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 20,
        gap: 6,
    },
    pillIcon: {
        fontSize: 15,
    },
    pillLabel: {
        color: '#9DA3B8',
        fontWeight: '600',
        fontSize: 14,
    },
});
