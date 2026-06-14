import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

const CATEGORIES = ['Önerilen', 'Video', 'Eğlence', 'Etkileşimli', 'Oyun'];

export default function RoomCategoryTabs({ activeCategory, onCategoryChange }) {
    return (
        <View style={styles.container}>
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.scrollContent}
            >
                {CATEGORIES.map(cat => {
                    const isActive = activeCategory === cat;
                    return (
                        <TouchableOpacity
                            key={cat}
                            style={styles.tabItem}
                            onPress={() => onCategoryChange(cat)}
                            activeOpacity={0.8}
                        >
                            <Text style={[
                                styles.tabText,
                                isActive && styles.tabTextActive
                            ]}>
                                {cat}
                            </Text>
                            {isActive && (
                                <View style={styles.tabIndicator} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderBottomWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        paddingBottom: 6,
        marginTop: 6,
    },
    scrollContent: {
        paddingHorizontal: 16,
        gap: 20,
    },
    tabItem: {
        alignItems: 'center',
        paddingVertical: 6,
        position: 'relative',
    },
    tabText: {
        fontSize: 13.5,
        color: '#9DA3B8',
        fontWeight: 'bold',
    },
    tabTextActive: {
        color: '#20E070', // Neon Green active color
    },
    tabIndicator: {
        width: 16,
        height: 2.5,
        borderRadius: 1,
        backgroundColor: '#20E070', // Neon Green line
        marginTop: 5,
        shadowColor: '#20E070',
        shadowOpacity: 0.6,
        shadowRadius: 2,
    },
});
