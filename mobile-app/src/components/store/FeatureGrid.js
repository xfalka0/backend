import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STORE_THEME } from '../../constants/storeTheme';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';

const FEATURES = [
    { id: 'likes', icon: 'eye', text: 'Seni beğenenleri gör' },
    { id: 'messages', icon: 'images', text: 'Keşfette paylaşım hakkı' },
    { id: 'unlimited_likes', icon: 'heart', text: 'Sınırsız beğeni' },
    { id: 'calls', icon: 'call', text: 'Sesli ve görüntülü arama' },
    { id: 'location', icon: 'location', text: 'Konum paylaş' },
    { id: 'boost', icon: 'rocket', text: 'Keşfette öne çık' },
];

export default function FeatureGrid() {
    return (
        <View style={styles.container}>
            <View style={styles.grid}>
                {FEATURES.map((item, index) => (
                    <Animated.View key={item.id} entering={FadeInUp.delay(2 * STORE_THEME.animations.staggerDelay + index * STORE_THEME.animations.staggerDelay).duration(300)} style={styles.card}>
                        <View style={styles.iconContainer}>
                            <Ionicons name={item.icon} size={16} color="#FF5C86" />
                        </View>
                        <Text style={styles.text} numberOfLines={2}>
                            {item.text}
                        </Text>
                    </Animated.View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: STORE_THEME.spacing.paddingHorizontal,
        marginBottom: 10,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    card: {
        width: '48.5%',
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: STORE_THEME.colors.surfaceDark,
        borderRadius: 12,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: STORE_THEME.colors.surfaceDarkBorder,
        gap: 8,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 61, 110, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: STORE_THEME.colors.textWhite,
        lineHeight: 18,
    },
});
