import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const FILTER_ITEMS = [
    { id: 'popular', label: 'Popüler', icon: 'trending-up-outline', iconType: 'ionicons', badge: 'Trend', badgeType: 'trend' },
    { id: 'vip', label: 'VIP', icon: 'crown', iconType: 'fontawesome', badge: 'VIP', badgeType: 'vip' },
    { id: 'new', label: 'Yeni', icon: 'sparkles-outline', iconType: 'ionicons', badge: 'Yeni', badgeType: 'new' },
    { id: 'near', label: 'Yakınımda', icon: 'location-outline', iconType: 'ionicons' },
    { id: 'tr', label: 'Türkiye', icon: 'globe-outline', iconType: 'ionicons' },
    { id: 'voice', label: 'Sesli', icon: 'mic-outline', iconType: 'ionicons' },
    { id: 'dating', label: 'Flört', icon: 'heart-outline', iconType: 'ionicons' },
];

// ─── Sub-Component: FilterChip ───────────────────────────────────────────
function FilterChip({ item, isActive, onPress }) {
    const isIonicons = item.iconType === 'ionicons';
    
    // Custom Badge Render Helper
    const renderBadge = () => {
        if (!item.badge) return null;
        
        let badgeStyle = styles.badgeDefault;
        let badgeTextStyle = styles.badgeTextDefault;
        
        if (item.badgeType === 'trend') {
            return (
                <View style={styles.trendBadgeContainer}>
                    <View style={styles.trendDot} />
                    <Text style={styles.trendBadgeText}>{item.badge}</Text>
                </View>
            );
        }
        
        if (item.badgeType === 'vip') {
            badgeStyle = styles.badgeVip;
            badgeTextStyle = styles.badgeTextVip;
        } else if (item.badgeType === 'new') {
            badgeStyle = styles.badgeNew;
            badgeTextStyle = styles.badgeTextNew;
        }
        
        return (
            <View style={badgeStyle}>
                <Text style={badgeTextStyle}>{item.badge}</Text>
            </View>
        );
    };

    const iconColor = isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.55)';

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            style={[
                styles.chip,
                isActive ? styles.activeChip : styles.inactiveChip
            ]}
        >
            {/* Left Vector Icon */}
            {isIonicons ? (
                <Ionicons name={item.icon} size={14} color={iconColor} />
            ) : (
                <FontAwesome5 name={item.icon} size={12} color={iconColor} />
            )}

            {/* Label */}
            <Text style={[
                styles.text,
                isActive ? styles.activeText : styles.inactiveText
            ]}>
                {item.label}
            </Text>

            {/* Optional Mini Badge */}
            {renderBadge()}
        </TouchableOpacity>
    );
}

// ─── Main Component: PartyFilterChips ────────────────────────────────────
export default function PartyFilterChips({ activeChip, onChipChange }) {
    return (
        <View style={styles.container}>
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {FILTER_ITEMS.map((item) => (
                    <FilterChip
                        key={item.id}
                        item={item}
                        isActive={activeChip === item.id}
                        onPress={() => onChipChange(item.id)}
                    />
                ))}
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
        paddingRight: 24, 
        gap: 10, 
        alignItems: 'center',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 38,
        borderRadius: 19,
        paddingHorizontal: 14,
        borderWidth: 1,
        gap: 6,
    },
    activeChip: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderColor: '#FF4D8D', 
        shadowColor: '#FF4D8D',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 1,
    },
    inactiveChip: {
        backgroundColor: 'rgba(255, 255, 255, 0.055)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    text: {
        fontSize: 13,
        fontWeight: '600',
    },
    activeText: {
        color: '#FFFFFF',
    },
    inactiveText: {
        color: 'rgba(255, 255, 255, 0.65)',
    },
    trendBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 77, 141, 0.12)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 4.5,
    },
    trendDot: {
        width: 5.5,
        height: 5.5,
        borderRadius: 2.75,
        backgroundColor: '#FF4D8D',
    },
    trendBadgeText: {
        color: '#FF4D8D',
        fontSize: 9,
        fontWeight: '800',
    },
    badgeVip: {
        backgroundColor: 'rgba(255, 155, 61, 0.12)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    badgeTextVip: {
        color: '#FF9B3D',
        fontSize: 9,
        fontWeight: '800',
    },
    badgeNew: {
        backgroundColor: 'rgba(0, 213, 255, 0.12)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    badgeTextNew: {
        color: '#00D5FF',
        fontSize: 9,
        fontWeight: '800',
    },
});
