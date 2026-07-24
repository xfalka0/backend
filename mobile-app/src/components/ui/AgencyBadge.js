import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function AgencyBadge({ agencyName, style, size = 15 }) {
    if (!agencyName || typeof agencyName !== 'string' || !agencyName.trim()) {
        return null;
    }

    const cleanName = agencyName.trim().toUpperCase();
    const height = size;
    const fontSize = Math.max(7, Math.round(height * 0.46));
    const iconSize = Math.max(7.5, Math.round(height * 0.48));

    return (
        <View style={[styles.container, { height }, style]}>
            <LinearGradient
                colors={['#f472b6', '#a855f7', '#7e22ce']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.gradientPill, { height, borderRadius: height / 2 }]}
            >
                <Ionicons name="sparkles" size={iconSize} color="#FFFFFF" />
                <Text style={[styles.badgeText, { fontSize }]} numberOfLines={1}>
                    {cleanName}
                </Text>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
    },
    gradientPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
        gap: 2,
        borderWidth: 0.8,
        borderColor: 'rgba(255, 255, 255, 0.35)',
        shadowColor: '#a855f7',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
    },
    badgeText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontStyle: 'italic',
        letterSpacing: 0.2,
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1.5,
        includeFontPadding: false,
    },
});
