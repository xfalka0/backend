
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withRepeat,

    withSequence,
    withDelay,
    Easing,
    runOnJS,
    interpolate,
    Extrapolation
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

const DestinyMatchModal = ({ visible, onClose, operators, navigation, user }) => {
    const { theme } = useTheme();
    const [matchState, setMatchState] = useState('idle'); // idle, searching, found
    const [matchedProfile, setMatchedProfile] = useState(null);
    const [displayProfile, setDisplayProfile] = useState(null); // For rapid shuffle

    // Animation Values
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0.6);
    const contentScale = useSharedValue(0.9);
    const contentOpacity = useSharedValue(0);
    const cardTranslateY = useSharedValue(50);
    const cardOpacity = useSharedValue(0);

    const shuffleIntervalRef = useRef(null);

    useEffect(() => {
        if (visible) {
            startSearchSequence();
        } else {
            resetState();
        }

        return () => {
            if (shuffleIntervalRef.current) clearInterval(shuffleIntervalRef.current);
        };
    }, [visible]);

    const resetState = () => {
        setMatchState('idle');
        setMatchedProfile(null);
        setDisplayProfile(null);
        pulseScale.value = 1;
        pulseOpacity.value = 0.6;
        contentScale.value = 0.9;
        contentOpacity.value = 0;
        cardTranslateY.value = 50;
        cardOpacity.value = 0;
    };

    const startSearchSequence = () => {
        if (!operators || operators.length === 0) return;

        setMatchState('searching');

        // Start Pulse Animation
        pulseScale.value = withRepeat(
            withSequence(
                withTiming(1.5, { duration: 1000, easing: Easing.out(Easing.ease) }),
                withTiming(1, { duration: 1000, easing: Easing.in(Easing.ease) })
            ),
            -1,
            true
        );

        pulseOpacity.value = withRepeat(
            withSequence(
                withTiming(0, { duration: 1000 }),
                withTiming(0.6, { duration: 1000 })
            ),
            -1,
            true
        );

        contentOpacity.value = withTiming(1, { duration: 500 });
        contentScale.value = withSpring(1);

        // Rapid Shuffle
        let shuffleTime = 0;
        const totalShuffleTime = 3000; // 3 seconds
        const interval = 120;

        shuffleIntervalRef.current = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * operators.length);
            setDisplayProfile(operators[randomIndex]);

            shuffleTime += interval;
            if (shuffleTime >= totalShuffleTime) {
                clearInterval(shuffleIntervalRef.current);
                const finalMatchIndex = Math.floor(Math.random() * operators.length);
                const finalMatch = operators[finalMatchIndex];
                finalizeMatch(finalMatch);
            }
        }, interval);
    };

    const finalizeMatch = (profile) => {
        setMatchedProfile(profile);
        setDisplayProfile(profile);
        setMatchState('found');

        // Stop Pulse
        pulseScale.value = withTiming(20, { duration: 800 }); // Expand out
        pulseOpacity.value = withTiming(0, { duration: 500 });

        // Highlight Match
        contentScale.value = withSequence(
            withTiming(1.1, { duration: 200 }),
            withSpring(1, { damping: 12 })
        );

        // Show Details Card
        cardOpacity.value = withDelay(300, withTiming(1, { duration: 600 }));
        cardTranslateY.value = withDelay(300, withSpring(0, { damping: 15 }));
    };

    const handleStartChat = () => {
        onClose();
        navigation.navigate('OperatorProfile', { operator: matchedProfile, user });
    };

    const handleSkip = () => {
        onClose();
    };

    // Animated Styles - Defined before early return to satisfy Rules of Hooks
    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: pulseOpacity.value
    }));

    const contentStyle = useAnimatedStyle(() => ({
        transform: [{ scale: contentScale.value }],
        opacity: contentOpacity.value
    }));

    const cardStyle = useAnimatedStyle(() => ({
        opacity: cardOpacity.value,
        transform: [{ translateY: cardTranslateY.value }]
    }));

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={styles.container}>
                {/* Premium Blur Background */}
                <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

                {/* Background Gradient Mesh (Subtle) */}
                <LinearGradient
                    colors={['rgba(76, 29, 149, 0.4)', 'rgba(236, 72, 153, 0.2)', 'transparent']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />

                <View style={styles.centerContainer}>
                    {/* Pulsing Glow Effect */}
                    <Animated.View style={[styles.pulseCircle, pulseStyle]}>
                        <LinearGradient
                            colors={['rgba(236, 72, 153, 0.5)', 'rgba(139, 92, 246, 0.5)']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                    </Animated.View>

                    {/* Main Content (Avatar) */}
                    <Animated.View style={[styles.avatarContainer, contentStyle]}>
                        <View style={styles.avatarBorder}>
                            <Image
                                source={{ uri: displayProfile?.avatar_url || 'https://via.placeholder.com/200' }}
                                style={styles.avatar}
                            />
                        </View>

                        {matchState === 'searching' && (
                            <View style={styles.searchingBadge}>
                                <Text style={styles.searchingText}>Kader taranıyor...</Text>
                            </View>
                        )}

                        {matchState === 'found' && (
                            <View style={styles.matchBadge}>
                                <Ionicons name="heart" size={24} color="white" />
                            </View>
                        )}
                    </Animated.View>

                    {/* Matched Profile Details Card */}
                    {matchState === 'found' && matchedProfile && (
                        <Animated.View style={[styles.card, cardStyle]}>
                            <Text style={styles.matchTitle}>Mükemmel Eşleşme!</Text>

                            <Text style={styles.name}>
                                {matchedProfile.name}, <Text style={styles.age}>{matchedProfile.age || 24}</Text>
                            </Text>

                            <Text style={styles.bio} numberOfLines={2}>
                                {matchedProfile.job || 'Yeni Üye'}
                            </Text>

                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    style={styles.primaryButtonWrapper}
                                    onPress={handleStartChat}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={['#8b5cf6', '#ec4899']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.primaryButton}
                                    >
                                        <Ionicons name="chatbubble-ellipses" size={20} color="white" style={{ marginRight: 8 }} />
                                        <Text style={styles.primaryButtonText}>Mesaj Gönder</Text>
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleSkip}
                                    style={styles.secondaryButton}
                                >
                                    <Text style={styles.secondaryButtonText}>Şimdilik Geç</Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    pulseCircle: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        zIndex: -1,
        overflow: 'hidden',
    },
    avatarContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 30,
        position: 'relative',
    },
    avatarBorder: {
        width: 200,
        height: 200,
        borderRadius: 100,
        borderWidth: 4,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        padding: 6,
        backgroundColor: 'rgba(0,0,0,0.3)',
        overflow: 'hidden',
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 100,
        backgroundColor: '#333'
    },
    searchingBadge: {
        position: 'absolute',
        bottom: -15,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    searchingText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.5
    },
    matchBadge: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#ec4899',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: '#1e1b4b',
        elevation: 10,
    },
    card: {
        width: width * 0.85,
        backgroundColor: 'rgba(30, 27, 75, 0.95)',
        borderRadius: 30,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 20,
    },
    matchTitle: {
        color: '#ec4899',
        fontSize: 14,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 12,
    },
    name: {
        color: 'white',
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    age: {
        fontWeight: 'normal',
        opacity: 0.8,
    },
    bio: {
        color: '#cbd5e1',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
        opacity: 0.8,
    },
    actionButtons: {
        width: '100%',
        gap: 16,
    },
    primaryButtonWrapper: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
    },
    primaryButton: {
        flex: 1,
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    secondaryButton: {
        padding: 12,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#94a3b8',
        fontSize: 15,
        fontWeight: '600',
    }
});

export default DestinyMatchModal;
