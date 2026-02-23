import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    interpolate,
    withRepeat,
    withSequence,
    withTiming,
    Extrapolation,
    Easing
} from 'react-native-reanimated';
import GlassCard from './GlassCard';

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width * 0.9;

const PROMOS = [
    { id: 1, title: 'İLK YÜKLEMENE ÖZEL', subtitle: '+100 Coin Hediye!', icon: 'trophy', colors: ['#f59e0b', '#d97706'], glow: '#fbbf24', buttonColor: '#fff' },
    { id: 2, title: 'HAFTALIK FIRSAT', subtitle: '%50 VIP İndirimi', icon: 'star', colors: ['#8b5cf6', '#d946ef'], glow: '#f472b6', buttonColor: '#fff' },
];

const AnimatedBannerItem = ({ item, index, scrollX, navigation }) => {
    const animatedStyle = useAnimatedStyle(() => {
        const inputRange = [
            (index - 1) * width,
            index * width,
            (index + 1) * width,
        ];

        const scale = interpolate(
            scrollX.value,
            inputRange,
            [0.9, 1, 0.9],
            Extrapolation.CLAMP
        );

        return {
            transform: [{ scale }],
        };
    });

    const glowValue = useSharedValue(1);
    const floatValue = useSharedValue(0);

    useEffect(() => {
        glowValue.value = withRepeat(
            withSequence(
                withTiming(1.15, { duration: 1200 }),
                withTiming(1, { duration: 1200 })
            ),
            -1,
            true
        );

        floatValue.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, []);

    const iconStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: glowValue.value },
            { translateY: interpolate(floatValue.value, [0, 1], [0, -10]) }
        ],
    }));

    return (
        <View style={{ width, alignItems: 'center', justifyContent: 'center' }} pointerEvents="box-none">
            <Animated.View style={[styles.bannerCardContainer, animatedStyle]}>
                <GlassCard style={styles.bannerCard} intensity={40} tint="dark">
                    <LinearGradient
                        colors={item.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />

                    {/* Glossy Overlay effect */}
                    <LinearGradient
                        colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.05)', 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.bannerDecorOverlay}
                    />

                    <View style={styles.bannerContent}>
                        <View style={styles.tagContainer}>
                            <Text style={styles.bannerTitle}>{item.title}</Text>
                        </View>
                        <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            style={styles.bannerButton}
                            onPress={() => navigation.navigate('Shop')}
                        >
                            <LinearGradient
                                colors={['#ffffff', '#f8fafc']}
                                style={styles.buttonGradient}
                            >
                                <Text style={styles.bannerButtonText}>ŞİMDİ KEŞFET</Text>
                                <Ionicons name="arrow-forward" size={12} color="#000" style={{ marginLeft: 4 }} />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.bannerIconWrapper}>
                        <Animated.View style={iconStyle}>
                            {item.id === 1 ? (
                                <View style={styles.iconGlowLayer}>
                                    <Image
                                        source={require('../../../assets/gold_coin_3f.png')}
                                        style={{ width: 100, height: 100 }}
                                        resizeMode="contain"
                                    />
                                </View>
                            ) : (
                                <View style={styles.iconCircleGlow}>
                                    <Ionicons name={item.icon} size={70} color="white" />
                                </View>
                            )}
                        </Animated.View>
                    </View>
                </GlassCard>
            </Animated.View>
        </View>
    );
};

export default function PromoBanner({ navigation }) {
    const scrollX = useSharedValue(0);
    const onScrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollX.value = event.contentOffset.x;
        },
    });

    return (
        <View style={styles.container}>
            <Animated.ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScrollHandler}
                scrollEventThrottle={16}
                contentContainerStyle={styles.bannerScrollContent}
            >
                {PROMOS.map((promo, index) => (
                    <AnimatedBannerItem
                        key={promo.id}
                        item={promo}
                        index={index}
                        scrollX={scrollX}
                        navigation={navigation}
                    />
                ))}
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 160,
        marginVertical: 10,
    },
    bannerScrollContent: {
        paddingVertical: 5,
    },
    bannerCardContainer: {
        width: BANNER_WIDTH,
        height: 140,
        borderRadius: 28,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 12,
    },
    bannerCard: {
        flex: 1,
        borderRadius: 28,
        padding: 22,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden'
    },
    bannerContent: { flex: 1.2, justifyContent: 'center' },
    tagContainer: {
        backgroundColor: 'rgba(0,0,0,0.15)',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 8,
        marginBottom: 6,
    },
    bannerTitle: { color: 'white', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
    bannerSubtitle: {
        color: 'white',
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 6,
        letterSpacing: -0.8,
        textShadowColor: 'rgba(0,0,0,0.2)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4
    },
    bannerButton: {
        marginTop: 10,
        borderRadius: 14,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    bannerButtonText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: -0.2 },
    bannerIconWrapper: { flex: 0.8, alignItems: 'center', justifyContent: 'center' },
    iconGlowLayer: {
        shadowColor: '#fcd34d',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 30,
    },
    iconCircleGlow: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    bannerDecorOverlay: {
        position: 'absolute',
        top: -50,
        left: -50,
        width: '150%',
        height: '150%',
        opacity: 0.6,
        transform: [{ rotate: '45deg' }]
    },
});
