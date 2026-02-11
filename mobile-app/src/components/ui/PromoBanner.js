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
    Extrapolate
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width * 0.9;

const PROMOS = [
    { id: 1, title: 'İLK YÜKLEMENE ÖZEL', subtitle: '+100 Coin Hediye!', icon: 'trophy', colors: ['#f59e0b', '#d97706'], glow: '#fbbf24' },
    { id: 2, title: 'HAFTALIK FIRSAT', subtitle: '%50 VIP İndirimi', icon: 'star', colors: ['#8b5cf6', '#d946ef'], glow: '#f472b6' },
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
            Extrapolate.CLAMP
        );

        return {
            transform: [{ scale }],
        };
    });

    const glowValue = useSharedValue(1);
    useEffect(() => {
        glowValue.value = withRepeat(
            withSequence(
                withTiming(1.15, { duration: 1200 }),
                withTiming(1, { duration: 1200 })
            ),
            -1,
            true
        );
    }, []);

    const iconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: glowValue.value }],
    }));

    return (
        <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[styles.bannerCardContainer, animatedStyle]}>
                <LinearGradient
                    colors={item.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.bannerCard}
                >
                    <View style={styles.bannerContent}>
                        <Text style={styles.bannerTitle}>{item.title}</Text>
                        <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
                        <TouchableOpacity
                            style={styles.bannerButton}
                            onPress={() => navigation.navigate('Shop')}
                        >
                            <Text style={styles.bannerButtonText}>ŞİMDİ KEŞFET</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.bannerIconWrapper}>
                        <Animated.View style={iconStyle}>
                            {item.id === 1 ? (
                                <Image
                                    source={require('../../../assets/gold_coin_3f.png')}
                                    style={{ width: 85, height: 85 }}
                                    resizeMode="contain"
                                />
                            ) : (
                                <Ionicons name={item.icon} size={60} color="white" />
                            )}
                        </Animated.View>
                    </View>
                </LinearGradient>
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
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
    },
    bannerCard: {
        flex: 1,
        borderRadius: 20,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden'
    },
    bannerContent: { flex: 1, justifyContent: 'center' },
    bannerTitle: { color: 'white', fontSize: 10, fontWeight: '800', opacity: 0.8, letterSpacing: 1 },
    bannerSubtitle: { color: 'white', fontSize: 18, fontWeight: '900', marginVertical: 3 },
    bannerButton: { backgroundColor: 'white', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 10, alignSelf: 'flex-start', marginTop: 10 },
    bannerButtonText: { color: '#000', fontWeight: 'bold', fontSize: 11 },
    bannerIconWrapper: { marginLeft: 5 },
});
