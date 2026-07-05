import React, { useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Animated, Text, Dimensions, View, Image } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { useRoomStore } from '../../store/useRoomStore';

const { width, height } = Dimensions.get('window');

// Premium animations mapping
const PREMIUM_ANIMATIONS = {
    6: {
        type: 'image',
        name: 'Yarış Arabası',
        source: require('../../../assets/yarisarabasi.webp'),
        icon: '🏎️'
    },
    7: {
        type: 'image',
        name: 'Şato',
        source: require('../../../assets/sato.webp'),
        icon: '🏰'
    }
};

export default function GiftAnimationOverlay({ giftEvent }) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    const seats = useRoomStore(s => s.seats);
    const members = useRoomStore(s => s.members);

    const premiumAnim = useMemo(() => {
        if (!giftEvent) return null;
        const id = Number(giftEvent.gift_id);
        if (PREMIUM_ANIMATIONS[id]) return PREMIUM_ANIMATIONS[id];
        
        // Fallback by name check
        if (giftEvent.gift_name === 'Yarış Arabası') return PREMIUM_ANIMATIONS[6];
        if (giftEvent.gift_name === 'Şato') return PREMIUM_ANIMATIONS[7];
        return null;
    }, [giftEvent]);

    const recipientUser = useMemo(() => {
        if (!giftEvent || !giftEvent.recipient_id) return null;
        const targetId = giftEvent.recipient_id.toString();
        const seatUser = seats.find(s => s.user_id?.toString() === targetId);
        if (seatUser) return seatUser;
        const memberUser = members.find(m => m.user_id?.toString() === targetId);
        return memberUser;
    }, [giftEvent, seats, members]);

    const senderName = giftEvent?.sender?.display_name || giftEvent?.sender?.username || 'Bilinmeyen';
    const receiverName = giftEvent?.receiver?.display_name || giftEvent?.receiver?.username || recipientUser?.display_name || recipientUser?.username || '';

    useEffect(() => {
        if (!giftEvent) return;

        if (premiumAnim) {
            opacityAnim.setValue(0);
            Animated.sequence([
                Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.delay(6000),
                Animated.timing(opacityAnim, { toValue: 0, duration: 500, useNativeDriver: true })
            ]).start();
        } else {
            // Reset
            scaleAnim.setValue(0);
            rotateAnim.setValue(0);
            opacityAnim.setValue(0);

            // Run animation
            Animated.sequence([
                // Fade in and pop scale
                Animated.parallel([
                    Animated.spring(scaleAnim, { toValue: 1.8, friction: 6, tension: 80, useNativeDriver: true }),
                    Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                    Animated.timing(rotateAnim, { toValue: 1, duration: 800, useNativeDriver: true })
                ]),
                Animated.delay(1800),
                // Fade out
                Animated.parallel([
                    Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
                    Animated.timing(scaleAnim, { toValue: 0.5, duration: 300, useNativeDriver: true })
                ])
            ]).start();
        }
    }, [giftEvent, premiumAnim]);

    if (!giftEvent) return null;

    if (premiumAnim) {
        return (
            <Animated.View style={[styles.videoOverlayContainer, { opacity: opacityAnim }]} pointerEvents="none">
                {/* Backdrop to dim the screen */}
                <View style={styles.backdrop} />
                {/* Announcement Banner */}
                <LinearGradient
                    colors={['rgba(251, 191, 36, 0.95)', 'rgba(217, 119, 6, 0.95)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.announcementBanner}
                >
                    <Text style={styles.announcementText}>
                        <Text style={styles.boldText}>{senderName}</Text> 
                        {receiverName ? (
                            <>
                                <Text style={styles.normalText}> → </Text>
                                <Text style={styles.boldText}>{receiverName}</Text>
                            </>
                        ) : null}
                        <Text style={styles.actionText}>{` ${premiumAnim.icon} ${premiumAnim.name} gönderdi!`}</Text>
                    </Text>
                </LinearGradient>

                {/* Animation Overlay (Video or Transparent Image) */}
                <View style={styles.videoWrapper}>
                    {premiumAnim.type === 'image' ? (
                        <Image
                            source={premiumAnim.source}
                            style={styles.videoPlayer}
                            resizeMode="contain"
                        />
                    ) : (
                        <Video
                            source={premiumAnim.source}
                            rate={1.0}
                            volume={1.0}
                            isMuted={false}
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay
                            style={styles.videoPlayer}
                        />
                    )}
                </View>
            </Animated.View>
        );
    }

    const icon = giftEvent.giftIcon || '🎁';

    const rotateInterpolate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    return (
        <Animated.View style={[
            styles.overlay, 
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }, { rotate: rotateInterpolate }] }
        ]}>
            <Text style={styles.animatedIcon}>{icon}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: height / 2.8,
        left: width / 2 - 40,
        width: 80,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        pointerEvents: 'none',
    },
    animatedIcon: {
        fontSize: 55,
        textShadowColor: '#ff007f',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    videoOverlayContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        pointerEvents: 'none',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.55)', // Dim background to make the animation pop
        zIndex: 1,
    },
    videoWrapper: {
        position: 'absolute',
        bottom: -140, // Offset the scaled transparent space at the bottom of the WebP file
        left: -width * 0.1, // Center the wider component horizontally
        width: width * 1.2, // Make it 20% wider
        height: width * 1.7, // Make it taller proportionally
        zIndex: 2,
        backgroundColor: 'transparent',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    videoPlayer: {
        width: width * 1.2,
        height: width * 1.7,
        backgroundColor: 'transparent',
    },
    announcementBanner: {
        position: 'absolute',
        top: 80, // Float beautifully at the top of the screen
        alignSelf: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        shadowColor: '#d97706',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
        borderWidth: 1.5,
        borderColor: '#fef3c7',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    announcementText: {
        color: '#ffffff',
        fontSize: 14,
        textAlign: 'center',
    },
    normalText: {
        color: '#ffffff',
        fontWeight: 'bold',
    },
    actionText: {
        color: '#ffffff',
        fontWeight: '700',
    },
    boldText: {
        fontWeight: '950',
        color: '#fff',
    },
});
