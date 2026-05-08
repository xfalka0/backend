import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Image } from 'react-native';
import FloatingParticles from './FloatingParticles';
import PremiumCoinCard from './PremiumCoinCard';
import DestinyHero from '../DestinyHero';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const HeroSection = ({ 
    onCoinPress, 
    onExplorePress, 
    onResellerPress, 
    onDestinyPress, 
    onLeaderboardPress,
    onNotificationsPress
}) => {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
            <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
                {/* Left Side: Empty */}
                <View style={{ flex: 1 }} />

                {/* Right Side: Notifications & Leaderboard */}
                <View style={styles.rightHeader}>
                    <TouchableOpacity 
                        onPress={onNotificationsPress}
                        style={styles.iconButton}
                        activeOpacity={0.7}
                    >
                        <LinearGradient
                            colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                            style={styles.iconGradient}
                        >
                            <Ionicons name="notifications-outline" size={18} color="#f5f3ff" />
                            <View style={styles.notificationDot} />
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={onLeaderboardPress}
                        style={styles.leaderboardBadge}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['rgba(139, 92, 246, 0.2)', 'rgba(0, 0, 0, 0.3)']}
                            style={styles.leaderboardGradient}
                        >
                            <Image 
                                source={require('../../../assets/kupa.png')} 
                                style={styles.badgeIcon}
                                resizeMode="contain"
                            />
                            <Text style={styles.leaderboardText}>SIRALAMA</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.content}>
                <PremiumCoinCard
                    onCoinPress={onCoinPress}
                    onExplorePress={onExplorePress}
                    onResellerPress={onResellerPress}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: width,
        paddingBottom: 2,
        position: 'relative',
        overflow: 'hidden',
    },
    headerWrapper: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 2,
        zIndex: 100,
    },
    leftHeader: {
        flex: 1,
        justifyContent: 'center',
    },
    greetingText: {
        color: '#f8fafc',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    rightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        overflow: 'hidden',
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    iconGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notificationDot: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ef4444',
        borderWidth: 1.5,
        borderColor: 'white',
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 4,
    },
    leaderboardBadge: {
        height: 28,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    leaderboardGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        height: '100%',
    },
    badgeIcon: {
        width: 14,
        height: 14,
    },
    leaderboardText: {
        color: 'white',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 1,
        marginLeft: 4,
        includeFontPadding: false,
    },
    content: {
        zIndex: 10,
    }
});

export default HeroSection;
