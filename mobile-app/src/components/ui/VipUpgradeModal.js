import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import SafeLottie from './SafeLottie';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

const VipUpgradeModal = ({ visible, level, onClose }) => {
    const { theme, themeMode } = useTheme();
    const scale = useSharedValue(0);
    // ... rest of shared values ...
    const opacity = useSharedValue(0);
    const textScale = useSharedValue(0.5);

    useEffect(() => {
        if (visible) {
            scale.value = withSpring(1, { damping: 12, stiffness: 100 });
            opacity.value = withTiming(1, { duration: 600 });
            textScale.value = withDelay(400, withSpring(1, { damping: 8, stiffness: 120 }));
        } else {
            scale.value = withTiming(0);
            opacity.value = withTiming(0);
            textScale.value = withTiming(0.5);
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const animatedTextStyle = useAnimatedStyle(() => ({
        transform: [{ scale: textScale.value }],
    }));

    const getColors = (lvl) => {
        switch (lvl) {
            case 1: return ['#cd7f32', '#92400e']; // Bronze
            case 2: return ['#cbd5e1', '#64748b']; // Silver
            case 3: return ['#fbbf24', '#b45309']; // Gold
            case 4: return ['#22d3ee', '#164e63']; // Platinum
            case 5: return ['#e879f9', '#be185d']; // Diamond
            case 6: return ['#fbbf24', '#4338ca']; // Obsidian (Gold + Indigo)
            default: return ['#fbbf24', '#d97706'];
        }
    };
    const currentColors = getColors(level);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={[styles.overlay, { backgroundColor: themeMode === 'dark' ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.7)' }]}>
                <Animated.View style={[styles.card, animatedStyle, { borderColor: `${currentColors[0]}88`, backgroundColor: theme.colors.background }]}>
                    <LinearGradient
                        colors={themeMode === 'dark' ? ['#0f172a', '#020617'] : [theme.colors.background, theme.colors.backgroundSecondary]}
                        style={styles.gradient}
                    >
                        {/* Radiant Background Glow */}
                        <View style={[styles.glowCircle, { backgroundColor: currentColors[0], opacity: themeMode === 'dark' ? 0.15 : 0.08 }]} />

                        <Animated.View style={animatedTextStyle}>
                            <Text style={[styles.congratsText, { color: currentColors[0] }]}>TEBRİKLER!</Text>
                        </Animated.View>

                        <View style={styles.levelContainer}>
                            <Text style={[styles.levelDesc, { color: theme.colors.textSecondary }]}>YENİ SEVİYEN:</Text>
                            <Animated.View style={[styles.badge, animatedTextStyle, { borderColor: currentColors[0], shadowColor: currentColors[0], backgroundColor: theme.colors.glass }]}>
                                <Text style={[styles.badgeText, { color: themeMode === 'dark' ? 'white' : theme.colors.text }]}>VIP {level}</Text>
                            </Animated.View>
                        </View>

                        <View style={styles.iconContainer}>
                            <LinearGradient
                                colors={currentColors}
                                style={styles.iconCircle}
                            >
                                <Ionicons name="sparkles" size={50} color="white" />
                            </LinearGradient>
                        </View>

                        <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                            Yeni ayrıcalıkların ve özel profil efektlerin başarıyla aktif edildi.
                        </Text>

                        <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.8}>
                            <LinearGradient
                                colors={currentColors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.buttonGradient}
                            >
                                <Text style={styles.buttonText}>HARİKA</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confetti: {
        position: 'absolute',
        top: 0,
        width: width,
        height: height,
        zIndex: 10,
        pointerEvents: 'none',
    },
    card: {
        width: width * 0.88,
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1.5,
        elevation: 25,
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.5,
        shadowRadius: 25,
    },
    gradient: {
        padding: 40,
        alignItems: 'center',
        position: 'relative',
    },
    glowContainer: {
        position: 'absolute',
        width: width,
        height: 300,
        top: -50,
        opacity: 0.2,
    },
    particles: {
        width: '100%',
        height: '100%',
    },
    glowCircle: {
        position: 'absolute',
        top: -100,
        width: 300,
        height: 300,
        borderRadius: 150,
        opacity: 0.15,
        zIndex: -1,
    },
    congratsText: {
        fontSize: 34,
        fontWeight: '900',
        letterSpacing: 4,
        marginBottom: 20,
        textAlign: 'center',
    },
    levelContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    levelDesc: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 2,
        marginBottom: 15,
    },
    badge: {
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
    },
    badgeText: {
        fontSize: 36,
        fontWeight: '900',
        fontStyle: 'italic',
    },
    iconContainer: {
        marginVertical: 20,
    },
    iconCircle: {
        width: 110,
        height: 110,
        borderRadius: 55,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    infoText: {
        color: '#cbd5e1',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 40,
        fontWeight: '500',
        paddingHorizontal: 15,
    },
    button: {
        width: '100%',
        height: 60,
        borderRadius: 18,
        overflow: 'hidden',
    },
    buttonGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 2,
    },
});

export default VipUpgradeModal;
