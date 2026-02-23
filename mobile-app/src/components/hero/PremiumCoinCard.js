import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    Easing,
    useDerivedValue,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import { Pressable } from 'react-native';
import GlassCard from '../ui/GlassCard';

const { width } = Dimensions.get('window');

const slides = [
    {
        id: '1',
        title: '+100 COIN Hediye!',
        subtitle: 'İlk yüklemene özel bonus',
        buttonText: 'ŞİMDİ AL',
        icon: 'sparkles',
        colors: ['rgba(245, 158, 11, 0.9)', 'rgba(217, 119, 6, 0.9)'],
        image: require('../../../assets/gold_coin_3f.png'),
        isCoin: true
    },
    {
        id: '2',
        tag: 'ÖZEL FIRSAT',
        title: 'Kaderindeki kişiyi keşfet',
        subtitle: 'Dokun ve eşleşmeni başlat ✨',
        buttonText: 'İNCELE',
        icon: 'star',
        colors: ['rgba(139, 92, 246, 0.9)', 'rgba(109, 40, 217, 0.9)'],
        image: require('../../../assets/gold_coin_3d.png'),
        isCoin: false
    }
];

const PremiumCoinCard = ({ onPress }) => {
    const shineX = useSharedValue(-200);
    const bannerShineX = useSharedValue(-500);
    const cardScale = useSharedValue(1);
    const ambientOpacity = useSharedValue(0.12);
    const buttonScale = useSharedValue(1);
    const pressScale = useSharedValue(1);
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        // Ambient Glow Pulse
        ambientOpacity.value = withRepeat(
            withSequence(
                withTiming(0.22, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.12, { duration: 5000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        // Breathing Scale
        cardScale.value = withRepeat(
            withSequence(
                withTiming(1.01, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );

        // Periodic Banner Sweep (Every 8 seconds)
        bannerShineX.value = withRepeat(
            withSequence(
                withTiming(600, { duration: 4000, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
                withTiming(-500, { duration: 0 }),
                withTiming(-500, { duration: 4000 })
            ),
            -1,
            false
        );

        shineX.value = withRepeat(
            withSequence(
                withTiming(350, { duration: 3000, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
                withTiming(-350, { duration: 0 }),
                withTiming(-350, { duration: 2500 })
            ),
            -1,
            false
        );

        buttonScale.value = withRepeat(
            withSequence(
                withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, []);

    const shineStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: shineX.value },
            { rotate: '-45deg' }
        ]
    }));

    const cardAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }]
    }));

    const ambientGlowStyle = useAnimatedStyle(() => ({
        opacity: ambientOpacity.value
    }));

    const bannerShineStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: bannerShineX.value }, { rotate: '-45deg' }]
    }));

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value * pressScale.value }]
    }));

    const handlePressIn = () => {
        pressScale.value = withTiming(0.97, { duration: 100 });
    };

    const handlePressOut = () => {
        pressScale.value = withTiming(1, { duration: 100 });
    };

    const onScroll = (event) => {
        const slideSize = event.nativeEvent.layoutMeasurement.width;
        const index = event.nativeEvent.contentOffset.x / slideSize;
        setActiveIndex(Math.round(index));
    };

    const renderItem = ({ item }) => {
        return (
            <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={{ width }}>
                {/* Passive Ambient Glow */}
                <Animated.View style={[styles.ambientGlow, ambientGlowStyle]} />

                {/* Back Glow Layer (Static) */}
                <View style={styles.cardGlow} />

                <Animated.View style={[styles.cardWrapper, cardAnimatedStyle]}>
                    <GlassCard style={styles.cardContainer} intensity={30} tint="dark">
                        <LinearGradient
                            colors={[
                                item.colors[0],
                                item.colors[1],
                                'rgba(0, 0, 0, 0.8)'
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                        />

                        {/* Periodic Banner Sweep */}
                        <Animated.View style={[styles.bannerSweep, bannerShineStyle]}>
                            <LinearGradient
                                colors={['transparent', 'rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)', 'transparent']}
                                start={{ x: 0, y: 0.5 }}
                                end={{ x: 1, y: 0.5 }}
                                style={StyleSheet.absoluteFill}
                            />
                        </Animated.View>

                        {/* Add subtle radial lighting effect */}
                        <View style={styles.radialOverlay} />

                        {/* Subtle Full-Card Overlay */}
                        <LinearGradient
                            colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.2)']}
                            style={styles.vignette}
                        />

                        <View style={styles.content}>
                            <View style={styles.textContainer}>
                                <View style={styles.tag}>
                                    <Text style={styles.tagText}>{item.tag}</Text>
                                </View>

                                <View style={styles.typographyContainer}>
                                    {item.isCoin ? (
                                        <>
                                            <Text style={styles.primaryText}>
                                                +100 <Text style={styles.coinHighlight}>COIN</Text>
                                            </Text>
                                            <Text style={styles.secondaryText}>Hediye!</Text>
                                        </>
                                    ) : (
                                        <Text style={styles.primaryText} numberOfLines={2} adjustsFontSizeToFit>
                                            {item.title}
                                        </Text>
                                    )}
                                    <Text style={styles.tertiaryText} numberOfLines={1} adjustsFontSizeToFit>
                                        {item.subtitle}
                                    </Text>
                                </View>

                                <Pressable
                                    onPressIn={handlePressIn}
                                    onPressOut={handlePressOut}
                                    onPress={onPress}>
                                    <Animated.View style={[styles.button, buttonAnimatedStyle]}>
                                        <LinearGradient
                                            colors={['#FBBF24', '#D97706', '#B45309']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={[StyleSheet.absoluteFill, { borderRadius: 30 }]}
                                        />

                                        <View style={styles.buttonContent}>
                                            <Text style={styles.buttonText}>{item.buttonText}</Text>
                                            <Ionicons name={item.icon} size={15} color="white" style={{ marginLeft: 6 }} />
                                        </View>

                                        {/* Top-Level Shine Layer (High Visibility) */}
                                        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 30 }]}>
                                            <Animated.View style={[styles.shine, shineStyle]}>
                                                <LinearGradient
                                                    colors={[
                                                        'rgba(255, 255, 255, 0)',
                                                        'rgba(255, 255, 255, 0.2)',
                                                        'rgba(255, 255, 255, 0.7)',
                                                        'rgba(255, 255, 255, 0.2)',
                                                        'rgba(255, 255, 255, 0)'
                                                    ]}
                                                    start={{ x: 0, y: 0.5 }}
                                                    end={{ x: 1, y: 0.5 }}
                                                    style={StyleSheet.absoluteFill}
                                                />
                                            </Animated.View>
                                        </View>
                                    </Animated.View>
                                </Pressable>
                            </View>

                            <View style={styles.imageContainer}>
                                <View style={styles.coinGlow} />
                                <Image
                                    source={item.image}
                                    style={styles.coinImage}
                                    resizeMode="contain"
                                />
                            </View>
                        </View>
                    </GlassCard>
                </Animated.View>

                {/* Bottom Aura Glow */}
                <LinearGradient
                    colors={['rgba(255, 170, 0, 0.15)', 'transparent']}
                    style={styles.bottomAura}
                />
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                data={slides}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                snapToAlignment="start"
                decelerationRate="fast"
                snapToInterval={width}
            />
            {/* Pagination Lines */}
            <View style={styles.paginationContainer}>
                {slides.map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.paginationLine,
                            {
                                backgroundColor: i === activeIndex ? 'white' : 'rgba(255,255,255,0.3)',
                                width: i === activeIndex ? 24 : 12
                            }
                        ]}
                    />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
    },
    cardContainer: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: 24,
    },
    cardWrapper: {
        width: width * 0.95,
        height: 140,
        alignSelf: 'center',
        zIndex: 1,
    },
    ambientGlow: {
        position: 'absolute',
        width: width * 0.95 + 10,
        height: 150,
        backgroundColor: 'rgba(255, 170, 0, 0.15)',
        borderRadius: 30,
        alignSelf: 'center',
        top: -5,
        shadowColor: 'rgba(255, 170, 0, 0.3)',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 10,
        zIndex: -2,
    },
    bannerSweep: {
        position: 'absolute',
        top: '-100%',
        left: 0,
        width: 150,
        height: '300%',
        zIndex: 2,
    },
    vignette: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    radialOverlay: {
        position: 'absolute',
        top: -60,
        left: -60,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        zIndex: 0, // Behind text
    },
    cardGlow: {
        position: 'absolute',
        width: '90%',
        height: '80%',
        backgroundColor: 'rgba(234, 179, 8, 0.15)',
        borderRadius: 40,
        alignSelf: 'center',
        top: '10%',
        shadowColor: '#EAB308',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
        zIndex: -1,
    },
    bottomAura: {
        position: 'absolute',
        bottom: -2,
        width: '60%',
        height: 12,
        borderRadius: 20,
        alignSelf: 'center',
        opacity: 0.6,
        zIndex: -2,
    },
    paginationContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 15,
        marginBottom: 10,
    },
    paginationLine: {
        height: 3,
        borderRadius: 2,
        marginHorizontal: 4,
    },
    shine: {
        position: 'absolute',
        top: '-100%',
        left: 0,
        width: 60,
        height: '300%',
        zIndex: 10,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    textContainer: {
        flex: 1.6,
        justifyContent: 'center',
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 2,
    },
    tag: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    tagText: {
        color: 'white',
        fontSize: 7,
        fontWeight: '900',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    typographyContainer: {
        marginBottom: 8,
    },
    primaryText: {
        color: 'white',
        fontSize: 20,
        fontWeight: '700',
        lineHeight: 22,
    },
    coinHighlight: {
        fontWeight: '900',
        color: '#FDE68A',
    },
    secondaryText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800',
        marginTop: -2,
        letterSpacing: -0.5,
    },
    tertiaryText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 10,
        fontWeight: '500',
        marginTop: 4,
    },
    button: {
        paddingHorizontal: 22,
        paddingVertical: 10,
        borderRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        shadowColor: '#D97706',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        overflow: 'visible',
    },
    buttonText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 13,
        letterSpacing: 1,
        zIndex: 10,
        textTransform: 'uppercase',
        textShadowColor: 'rgba(0, 0, 0, 0.15)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    imageContainer: {
        flex: 1,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
    },
    coinImage: {
        width: 100,
        height: 100,
        zIndex: 2,
    },
    coinGlow: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FDE68A',
        opacity: 0.35,
        shadowColor: '#FBBF24',
        shadowRadius: 25,
        shadowOpacity: 1,
        elevation: 15,
    }
});

export default PremiumCoinCard;
