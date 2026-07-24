import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';

export default function AgencyBadge({ agencyName, style, size = 20 }) {
    if (!agencyName || typeof agencyName !== 'string' || !agencyName.trim()) {
        return null;
    }

    const cleanName = agencyName.trim().toUpperCase();

    // Aspect ratio & proportional sizing
    const height = size;
    const paddingLeft = Math.round(height * 1.25); // Gives room for the left diamond/gem icon
    const paddingRight = Math.round(height * 0.45);
    const fontSize = Math.max(8, Math.round(height * 0.45));

    return (
        <View style={[styles.container, { height }, style]}>
            <ImageBackground
                source={require('../../../assets/ajansbanner.png')}
                style={[
                    styles.bannerBg, 
                    { 
                        height, 
                        paddingLeft, 
                        paddingRight 
                    }
                ]}
                resizeMode="stretch"
            >
                <Text 
                    style={[
                        styles.badgeText, 
                        { fontSize }
                    ]} 
                    numberOfLines={1}
                >
                    {cleanName}
                </Text>
            </ImageBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    bannerBg: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontStyle: 'italic',
        letterSpacing: 0.4,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});
