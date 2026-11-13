import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image, FlatList, Pressable, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming
} from 'react-native-reanimated';
import GlassCard from '../ui/GlassCard';
import { useNavigation } from '@react-navigation/native';
import { useScreenActive } from '../../utils/useScreenActive';

const { width } = Dimensions.get('window');

const slides = [
    {
        id: '1',
        title: '+100 COIN Hediye!',
        subtitle: 'İlk yüklemene özel bonus',
        buttonText: 'ŞİMDİ AL',
        icon: 'sparkles',
        colors: ['#f59e0b', '#d97706'],
        buttonColors: ['#FBBF24', '#D97706', '#B45309'],
        image: require('../../../assets/gold_coin_3f.png'),
        isCoin: true
    },
    {
        id: '3',
        title: 'Coin Bayisi ile İndirimli Paket Al!',
        subtitle: 'Yetkili bayimizden indirimli ve bonuslu paketleri anında yükle',
        buttonText: 'BAYİDEN İNDİRİMLİ AL',
        icon: 'logo-whatsapp',
        colors: ['#34d399', '#059669'],
        buttonColors: ['#34D399', '#10B981', '#059669'],
        image: require('../../../assets/reseller_coins.png'),
        isCoin: false,
        isHeart: false,
        isReseller: true
    },
    {
        id: '4',
        title: 'AJANS SAHİBİ OL',
        subtitle: 'Kendi Ekibini Kur, Kazan! ⚡',
        buttonText: 'BAŞVURU YAP',
        icon: 'business',
        colors: ['#06b6d4', '#0891b2'],
        buttonColors: ['#22d3ee', '#06b6d4', '#0891b2'],
        image: require('../../../assets/kupa.png'),
        isCoin: false,
        isHeart: false,
        isAgency: true
    }
].filter(item => !item.isAgency);


const PremiumCoinCard = ({ onCoinPress, onExplorePress, onResellerPress }) => {
    const navigation = useNavigation();
    const { isActive, isLowPerf } = useScreenActive();

    const pressScale = useSharedValue(1);
    const [activeIndex, setActiveIndex] = useState(0);
    const activeIndexRef = useRef(0);
    const flatListRef = useRef(null);

    useEffect(() => {
        activeIndexRef.current = activeIndex;
    }, [activeIndex]);

    // Auto-scroll ONLY while host screen is focused and app is foregrounded
    useEffect(() => {
        if (!isActive || slides.length <= 1) return;

        const intervalId = setInterval(() => {
            if (flatListRef.current && slides.length > 0) {
                const currentIndex = isNaN(activeIndexRef.current) ? 0 : activeIndexRef.current;
                const nextIndex = (currentIndex + 1) % slides.length;

                try {
                    flatListRef.current.scrollToIndex({
                        index: nextIndex,
                        animated: !isLowPerf,
                    });
                    setActiveIndex(nextIndex);
                } catch (err) {
                    console.log('Scroll error:', err);
                }
            }
        }, 15000);

        return () => clearInterval(intervalId);
    }, [isActive, isLowPerf]);

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pressScale.value }]
    }));

    const coinAnimatedStyle = {
        transform: [{ scale: 1.05 }]
    };

    const handlePressIn = () => {
        pressScale.value = withTiming(0.97, { duration: 100 });
    };

    const handlePressOut = () => {
        pressScale.value = withTiming(1, { duration: 100 });
    };

    const onScroll = (event) => {
        const slideSize = event.nativeEvent.layoutMeasurement.width;
        if (slideSize > 0) {
            const index = event.nativeEvent.contentOffset.x / slideSize;
            const roundedIndex = Math.round(index);
            if (!isNaN(roundedIndex)) {
                setActiveIndex(roundedIndex);
            }
        }
    };

    const renderItem = ({ item }) => {
        const handlePress = () => {
            if (item.isCoin) {
                onCoinPress?.();
            } else if (item.isHeart) {
                onExplorePress?.();
            } else if (item.isReseller) {
                if (onResellerPress) { onResellerPress(); } else { navigation.navigate('OperatorProfile', { operator: { id: 66, user_id: 66, name: 'FS Coin Bayi', display_name: 'FS Coin Bayi' } }); }
            } else if (item.isAgency) {
                Linking.openURL('https://forms.gle/vsw1ay6J719NvmLD7');
            }
        };

        return (
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handlePress}
                style={{ width }}
            >
                {item.isCoin && <View style={styles.cardGlow} />}
                {item.isAgency && <View style={[styles.cardGlow, { backgroundColor: 'rgba(6, 182, 212, 0.15)', shadowColor: '#06b6d4' }]} />}
                <View style={styles.cardWrapper}>
                    <GlassCard style={styles.cardContainer} intensity={30} tint="dark">
                        <LinearGradient
                            colors={[item.colors[0], item.colors[1]]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={StyleSheet.absoluteFill}
                        />

                        <View style={styles.content}>
                            <View style={styles.textContainer}>
                                {item.tag && (
                                    <View style={styles.tag}>
                                        <Text style={styles.tagText}>{item.tag}</Text>
                                    </View>
                                )}

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

                                {/* Button Container */}
                                <TouchableOpacity activeOpacity={0.8} onPress={handlePress}>
                                    <Animated.View style={[
                                        styles.button,
                                        buttonAnimatedStyle,
                                        item.isHeart && { shadowColor: '#E11D48', borderColor: 'rgba(255, 255, 255, 0.5)' },
                                        item.isAgency && { shadowColor: '#06b6d4', borderColor: 'rgba(255, 255, 255, 0.5)' }
                                    ]}>
                                        <LinearGradient
                                            colors={item.buttonColors}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={[StyleSheet.absoluteFill, { borderRadius: 30 }]}
                                        />

                                        <View style={styles.buttonContent}>
                                            <Text style={styles.buttonText}>{item.buttonText}</Text>
                                            <Ionicons name={item.icon} size={15} color="white" style={{ marginLeft: 6 }} />
                                        </View>
                                    </Animated.View>
                                </TouchableOpacity>
                                {/* End Button Container */}
                            </View>

                            <View style={styles.imageContainer}>
                                <Animated.Image
                                    source={item.image}
                                    style={[styles.coinImage, (item.isCoin || item.isReseller || item.isAgency) ? coinAnimatedStyle : null]}
                                    resizeMode="contain"
                                />
                            </View>
                        </View>
                    </GlassCard>
                </View>
                <LinearGradient colors={['rgba(255, 170, 0, 0.15)', 'transparent']} style={styles.bottomAura} />
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
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
                onScrollToIndexFailed={(info) => {
                    flatListRef.current?.scrollToOffset({
                        offset: info.averageItemLength * info.index,
                        animated: true,
                    });
                }}
            />
            <View style={styles.paginationContainer}>
                {slides.map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.paginationDot,
                            {
                                backgroundColor: i === activeIndex ? 'white' : 'rgba(255,255,255,0.2)',
                                width: i === activeIndex ? 18 : 6
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
        height: 118, // Reduced from 140
        alignSelf: 'center',
        zIndex: 1,
    },
    ambientGlow: {
        position: 'absolute',
        width: width * 0.95 + 10,
        height: 125, // Reduced from 150
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
        marginTop: 8,
        marginBottom: 2,
    },
    paginationDot: {
        height: 6,
        borderRadius: 3,
        marginHorizontal: 3,
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
        paddingVertical: 10, // Reduced from 14
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
        fontSize: 18, // Reduced from 20
        fontWeight: '700',
        lineHeight: 20,
    },
    coinHighlight: {
        fontWeight: '900',
        color: '#FDE68A',
    },
    secondaryText: {
        color: 'white',
        fontSize: 14, // Reduced from 16
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
        paddingHorizontal: 18, // Reduced from 22
        paddingVertical: 8, // Reduced from 10
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
        fontSize: 11, // Reduced from 13
        letterSpacing: 1,
        zIndex: 10,
        textTransform: 'uppercase',
        textShadowColor: 'rgba(0, 0, 0, 0.15)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    imageContainer: {
        flex: 1,
        height: 100, // Reduced from 120
        justifyContent: 'center',
        alignItems: 'center',
    },
    coinImage: {
        width: 85, // Reduced from 100
        height: 85, // Reduced from 100
        zIndex: 5,
    },
    heartImageLarge: {
        width: 130,
        height: 130,
        transform: [{ scale: 1.1 }],
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
    },
    floatingEmber: {
        position: 'absolute',
        bottom: '10%',
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FEF3C7', // Light yellow
        shadowColor: '#FBBF24',
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 8,
    }
});

export default PremiumCoinCard;
