import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const CATEGORIES = ['Önerilen', 'Video', 'Eğlence', 'Etkileşimli', 'Oyun'];

export default function PartyCategoryTabs({ activeCategory, onCategoryChange }) {
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
                                <LinearGradient
                                    colors={['#21F58B', '#00D5FF']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.tabIndicator}
                                />
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
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        paddingBottom: 2,
        marginTop: 6,
    },
    scrollContent: {
        paddingHorizontal: 16,
        gap: 22,
    },
    tabItem: {
        alignItems: 'center',
        paddingVertical: 8,
        position: 'relative',
    },
    tabText: {
        fontSize: 14.5,
        color: 'rgba(255, 255, 255, 0.55)',
        fontWeight: '600',
    },
    tabTextActive: {
        color: '#21F58B', 
        fontWeight: '700',
        textShadowColor: 'rgba(33, 245, 139, 0.35)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 6,
    },
    tabIndicator: {
        width: 16,
        height: 2.5,
        borderRadius: 1.25,
        marginTop: 5,
    },
});
