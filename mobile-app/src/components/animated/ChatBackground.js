import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

const ChatBackground = React.memo(({ themeMode }) => {
    // Memoize Background Patterns to prevent flickering and heavy recalculations
    const patterns = useMemo(() => ({
        hearts: [...Array(12)].map((_, i) => ({
            id: i,
            size: Math.random() * 30 + 15,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            rotate: `${Math.random() * 360}deg`,
        })),
        sparkles: [...Array(20)].map((_, i) => ({
            id: i,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.4 + 0.2,
        }))
    }), []);

    return (
        <View style={styles.background} pointerEvents="none">
            {/* Pure Gradient Background */}
            <LinearGradient
                colors={themeMode === 'dark' ? ['#0f051a', '#1a0b2e', '#0f051a'] : ['#fff0f5', '#ffe4f0', '#fff0f5']}
                style={StyleSheet.absoluteFill}
            />

            {/* HEART PATTERN OVERLAY */}
            <View style={[StyleSheet.absoluteFill, { opacity: themeMode === 'dark' ? 0.05 : 0.1 }]}>
                {patterns.hearts.map((heart) => (
                    <Ionicons
                        key={heart.id}
                        name="heart"
                        size={heart.size}
                        color={themeMode === 'dark' ? '#fff' : '#ff4d6d'}
                        style={{
                            position: 'absolute',
                            top: heart.top,
                            left: heart.left,
                            opacity: 0.6,
                            transform: [{ rotate: heart.rotate }]
                        }}
                    />
                ))}
            </View>

            {/* SPARKLE EFFECT (Tiny glowing dots) */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {patterns.sparkles.map((sparkle) => (
                    <View
                        key={sparkle.id}
                        style={{
                            position: 'absolute',
                            width: 2,
                            height: 2,
                            borderRadius: 1,
                            backgroundColor: '#fff',
                            top: sparkle.top,
                            left: sparkle.left,
                            opacity: themeMode === 'dark' ? sparkle.opacity : sparkle.opacity * 1.5,
                            shadowColor: '#fff',
                            shadowRadius: 4,
                            shadowOpacity: 1,
                        }}
                    />
                ))}
            </View>

            <BlurView
                intensity={themeMode === 'dark' ? 40 : 20}
                style={StyleSheet.absoluteFill}
                tint={themeMode === 'dark' ? 'dark' : 'light'}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    background: {
        ...StyleSheet.absoluteFillObject,
    },
});

export default ChatBackground;
