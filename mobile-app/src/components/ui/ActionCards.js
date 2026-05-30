import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ActionCards({ onRewardsPress, onInvitePress, theme }) {
    const bgColor = theme?.colors?.background || '#110C24';
    const shakeAnimation = useRef(new Animated.Value(0)).current;
    const scrollAnimation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const scrollSequence = Animated.sequence([
            // Gelirken yavaşça dur (ortaya gel)
            Animated.timing(scrollAnimation, {
                toValue: 0.5,
                duration: 4000,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            // Ortada bekle
            Animated.delay(3500),
            // Hızlanarak çık (sola doğru git)
            Animated.timing(scrollAnimation, {
                toValue: 1,
                duration: 4000,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }),
            // Tekrar sağa sıfırla
            Animated.timing(scrollAnimation, {
                toValue: 0,
                duration: 0,
                useNativeDriver: true,
            }),
            Animated.delay(1000)
        ]);
        const shake = Animated.sequence([
            Animated.timing(shakeAnimation, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(shakeAnimation, { toValue: -0.8, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(shakeAnimation, { toValue: 0.5, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(shakeAnimation, { toValue: -0.2, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(shakeAnimation, { toValue: 0, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.delay(5000),
        ]);

        Animated.loop(shake).start();
    }, [shakeAnimation]);

    const translateX = scrollAnimation.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [10, -150, 10] 
    });

    useEffect(() => {
        const scrollSequence = Animated.sequence([
            Animated.timing(scrollAnimation, {
                toValue: 0.5,
                duration: 5000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(scrollAnimation, {
                toValue: 1,
                duration: 5000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
            })
        ]);

        Animated.loop(scrollSequence).start();
    }, [scrollAnimation]);

    return (
        <View style={styles.container}>
            {/* Rewards Card */}
            <TouchableOpacity 
                style={styles.cardWrapper} 
                onPress={onRewardsPress}
                activeOpacity={0.9}
            >
                {/* 
                  Using asymmetric border radius (borderTopRightRadius: 65) creates a beautiful 
                  natural cutout shape for the icon to float outside of, without needing any SVG masks!
                */}
                <LinearGradient
                    colors={['#8b5cf6', '#6d28d9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.card, { borderTopRightRadius: 65, borderBottomRightRadius: 22 }]}
                >
                    <View style={styles.circleOverlayRight} />
                    <View style={styles.circleOverlaySmall} />
                    <View style={styles.glassOverlay} />

                    <View style={styles.textContainer}>
                        <Text style={styles.title}>Sıralama</Text>
                        <Text style={styles.subtitle}>Liderleri gör</Text>
                    </View>
                </LinearGradient>

                {/* Trophy Image sits outside the overflow: hidden gradient to break out of the box */}
                <View style={styles.doubleCoinContainer}>
                    <Animated.Image 
                        source={require('../../../assets/kupa.png')} 
                        style={[styles.trophyImage, { transform: [{ rotate: shakeAnimation.interpolate({ inputRange: [-1, 1], outputRange: ['-5deg', '5deg'] }) }] }]} 
                        resizeMode="contain"
                    />
                </View>
            </TouchableOpacity>

            {/* Invite Card */}
            <TouchableOpacity 
                style={styles.cardWrapper} 
                onPress={onInvitePress}
                activeOpacity={0.9}
            >
                <LinearGradient
                    colors={['#4ade80', '#22c55e']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.card, { borderTopRightRadius: 65, borderBottomRightRadius: 22 }]}
                >
                    <View style={styles.circleOverlayRight} />
                    <View style={styles.circleOverlaySmall} />
                    <View style={styles.glassOverlay} />

                    <View style={[styles.textContainer, { overflow: 'hidden', justifyContent: 'center' }]}>
                        <Animated.View style={{ transform: [{ translateX }] }}>
                            <Text style={[styles.title, { width: 400 }]}>
                                Davet et          ödül kazan
                            </Text>
                        </Animated.View>
                    </View>
                </LinearGradient>

                {/* Double 3D Coin Image Composition */}
                <View style={styles.doubleCoinContainer}>
                    <View style={styles.glowCircle} />
                    <Animated.Image 
                        source={require('../../../assets/gold_coin_3f.png')} 
                        style={[styles.coinBackImage, { transform: [{ rotate: shakeAnimation.interpolate({ inputRange: [-1, 1], outputRange: ['-5deg', '5deg'] }) }] }]} 
                        resizeMode="contain"
                    />
                    <Animated.Image 
                        source={require('../../../assets/gold_coin_3f.png')} 
                        style={[styles.coinFrontImage, { transform: [{ rotate: shakeAnimation.interpolate({ inputRange: [-1, 1], outputRange: ['-10deg', '10deg'] }) }] }]} 
                        resizeMode="contain"
                    />
                </View>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 12,
        marginBottom: 16,
    },
    cardWrapper: {
        flex: 1,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    card: {
        height: 75,
        borderRadius: 22,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    circleOverlayRight: {
        position: 'absolute',
        right: -30,
        top: -20,
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        zIndex: 0,
    },
    circleOverlaySmall: {
        position: 'absolute',
        right: 60,
        bottom: -30,
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        zIndex: 0,
    },
    glassOverlay: {
        position: 'absolute',
        left: -15,
        top: -40,
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        zIndex: 0,
    },
    textContainer: {
        flex: 1,
        zIndex: 2,
        marginRight: 75,
    },
    title: {
        fontFamily: 'Outfit_800ExtraBold',
        fontSize: 20,
        color: '#fff',
        marginBottom: 2,
    },
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    subtitleHighlight: {
        fontFamily: 'Outfit_500Medium',
        fontSize: 13,
        color: '#fff',
        opacity: 0.9,
    },
    miniCoin: {
        backgroundColor: '#FFD700',
        width: 14,
        height: 14,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: '#FFA500',
    },
    subtitle: {
        fontFamily: 'Outfit_500Medium',
        fontSize: 13,
        color: '#fff',
        opacity: 0.7,
    },
    doubleCoinContainer: {
        position: 'absolute',
        right: -15,
        top: -15,
        width: 95,
        height: 95,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    glowCircle: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FFF',
        opacity: 0.25,
        shadowColor: '#FFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 20,
        elevation: 10,
    },
    coinBackImage: {
        position: 'absolute',
        width: 65,
        height: 65,
        right: 25,
        top: 5,
    },
    coinFrontImage: {
        position: 'absolute',
        width: 45,
        height: 45,
        right: 5,
        bottom: 10,
    },
    trophyImage: {
        position: 'absolute',
        width: 85,
        height: 85,
        right: 5,
        top: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    }
});
