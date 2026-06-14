import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function RoomGiftBanner({ giftEvent }) {
    const slideX = useRef(new Animated.Value(-width)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!giftEvent) return;
        Animated.sequence([
            Animated.parallel([
                Animated.spring(slideX, { toValue: 0, tension: 70, friction: 14, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
            ]),
            Animated.delay(3200),
            Animated.parallel([
                Animated.timing(slideX, { toValue: width, duration: 350, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
            ]),
        ]).start();
    }, [giftEvent]);

    const isMock = !giftEvent;
    const senderName = giftEvent?.sender?.display_name || giftEvent?.sender?.username || 'Zamorano';
    const receiverName = giftEvent?.receiver?.display_name || giftEvent?.receiver?.username || 'FishingStar';
    const giftIcon = giftEvent?.giftIcon || '💎';
    const giftName = giftEvent?.giftName || 'Galaksi';
    const amount = giftEvent?.giftCost || 80155;
    const avatarUrl = giftEvent?.sender?.avatar_url;

    return (
        <Animated.View style={[
            styles.bannerContainer,
            !isMock && { transform: [{ translateX: slideX }], opacity }
        ]}>
            <LinearGradient
                colors={isMock ? ['rgba(29, 78, 216, 0.35)', 'rgba(67, 56, 202, 0.35)'] : ['#06b6d4', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradient}
            >
                <View style={styles.leftSection}>
                    {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Ionicons name="person" size={10} color="#00f3ff" />
                        </View>
                    )}
                </View>
                <Text style={styles.bannerText} numberOfLines={1}>
                    {isMock ? (
                        <Text style={styles.mockText}>
                            🎉 <Text style={{ color: '#00f3ff', fontWeight: 'bold' }}>Zamorano</Text>
                            , FishingStar'a 80155 hediye attı kazandırdı!
                        </Text>
                    ) : (
                        <Text style={styles.activeText}>
                            🔥 <Text style={{ fontWeight: 'bold' }}>{senderName}</Text>
                            {' → '}
                            <Text style={{ fontWeight: 'bold' }}>{receiverName}</Text>
                            {' '}{giftIcon} {amount} {giftName} gönderdi!
                        </Text>
                    )}
                </Text>
                <View style={styles.iconContainer}>
                    <Text style={styles.giftIcon}>{giftIcon}</Text>
                </View>
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    bannerContainer: {
        marginHorizontal: 20,
        marginTop: 6,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0, 243, 255, 0.35)',
        shadowColor: '#00f3ff',
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 1 },
        elevation: 4,
    },
    gradient: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 30,
        paddingHorizontal: 6,
        gap: 6,
    },
    leftSection: {
        width: 22,
        height: 22,
        borderRadius: 11,
        overflow: 'hidden',
        borderWidth: 0.8,
        borderColor: '#00f3ff',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerText: {
        flex: 1,
        fontSize: 9.5,
        color: '#fff',
    },
    mockText: {
        color: 'rgba(255,255,255,0.9)',
    },
    activeText: {
        color: '#ffffff',
    },
    iconContainer: {
        width: 22,
        height: 22,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    giftIcon: {
        fontSize: 12,
    },
});
