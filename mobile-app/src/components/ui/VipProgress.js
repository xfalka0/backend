import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
} from 'react-native-reanimated';

const VipProgress = ({ currentPoints, nextLevelPoints, currentLevel }) => {
    const progress = Math.min(currentPoints / nextLevelPoints, 1);
    const animatedWidth = useSharedValue(0);

    useEffect(() => {
        // Spring animasyonu ile daha dinamik dolum
        animatedWidth.value = withSpring(progress * 100, {
            damping: 15,
            stiffness: 100,
            mass: 1
        });
    }, [progress]);

    const animatedStyle = useAnimatedStyle(() => ({
        width: `${animatedWidth.value}%`,
    }));

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.levelLabel}>MEVCUT SEVİYE: <Text style={styles.boldText}>VIP {currentLevel}</Text></Text>
                <Text style={styles.pointsLabel}>{currentPoints} / {nextLevelPoints}</Text>
            </View>

            <View style={styles.progressBarBg}>
                <Animated.View style={[styles.progressBarFill, animatedStyle]}>
                    <LinearGradient
                        colors={['#fbbf24', '#f59e0b', '#d97706']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Bir sonraki seviyeye <Text style={styles.highlightText}>{Math.max(nextLevelPoints - currentPoints, 0)}</Text> puan kaldı
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        borderRadius: 24,
        marginHorizontal: 15,
        marginTop: 5,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.03)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    levelLabel: {
        color: '#94a3b8',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
    },
    boldText: {
        color: 'white',
        fontWeight: '900',
    },
    pointsLabel: {
        color: '#fbbf24',
        fontSize: 12,
        fontWeight: '800',
    },
    progressBarBg: {
        height: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    footer: {
        marginTop: 10,
        alignItems: 'center',
    },
    footerText: {
        color: '#64748b',
        fontSize: 10,
        fontWeight: '700',
    },
    highlightText: {
        color: 'white',
        fontWeight: '800',
    }
});

export default VipProgress;
