import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, SafeAreaView, Dimensions, StatusBar, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { PurchaseService } from '../services/purchaseService';
import { useEffect, useState, useRef } from 'react';
import { Motion } from '../components/motion/MotionSystem';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ModernAlert from '../components/ui/ModernAlert';
import { STORE_THEME } from '../constants/storeTheme';
import { Modal } from 'react-native';

const { width } = Dimensions.get('window');

const getBalanceGlowStyle = (bal) => {
    const numBal = Number(bal) || 0;
    if (numBal >= 20000) {
        return {
            textShadowColor: 'rgba(255, 215, 0, 0.7)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 8,
            color: '#FFF9E6'
        };
    } else if (numBal >= 10000) {
        return {
            textShadowColor: 'rgba(0, 255, 255, 0.7)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 6,
            color: '#E0FFFF'
        };
    } else if (numBal >= 5000) {
        return {
            textShadowColor: 'rgba(255, 255, 255, 0.6)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
            color: '#FFFFFF'
        };
    }
    return { color: '#FFFFFF' };
};


// Bonus & label config per coin amount
const PACKAGE_CONFIG = {
    '100':   { bonus: 10 },
    '200':   { bonus: 25 },
    '400':   { bonus: 60 },
    '700':   { bonus: 120 },
    '1200':  { bonus: 250 },
    '2500':  { bonus: 600 },
    '5000':  { bonus: 1500 },
    '10000': { bonus: 4000 },
    '20000': { bonus: 9000 },
    '40000': { bonus: 20000 },
};

const CoinPackageCard = React.memo(({ pack, index, handlePurchaseIntent, isPopular, isCheapest }) => {
    const product = pack.product;
    const coinAmountStr = product.title ? product.title.split(' ')[0] : (product.coins || '0');
    const coinAmount = parseInt(coinAmountStr, 10) || 0;
    const config = PACKAGE_CONFIG[coinAmount] || { bonus: 0 };
    const price = product.price;

    const rate = price > 0 ? (price / coinAmount).toFixed(2) : '0.00';
    
    // Icon scaling based on amount
    let coinScale = 1;
    if (coinAmount >= 10000) coinScale = 1.2;
    else if (coinAmount >= 5000) coinScale = 1.1;
    else if (coinAmount >= 1200) coinScale = 1.05;
    
    return (
        <Motion.SlideUp delay={index * 50}>
            <TouchableOpacity
                style={styles.cardContainer}
                onPress={() => handlePurchaseIntent(pack)}
                activeOpacity={0.75}
                accessibilityLabel={`${coinAmount} coin, ${product.priceString}`}
            >
                {isPopular && (
                    <View style={[StyleSheet.absoluteFill, { borderRadius: STORE_THEME.spacing.borderRadius, backgroundColor: STORE_THEME.colors.goldGlow, top: -4, bottom: -4, left: -4, right: -4 }]} pointerEvents="none" />
                )}
                <View style={[
                    styles.card,
                    { backgroundColor: STORE_THEME.colors.surfaceDark, borderColor: isPopular ? STORE_THEME.colors.accentGold : STORE_THEME.colors.surfaceDarkBorder },
                ]}>
                    {/* Top Badges */}
                    <View style={styles.badgeRow}>
                        {isPopular && (
                            <View style={[styles.ribbon, { backgroundColor: STORE_THEME.colors.accentGold }]}>
                                <Text style={[styles.ribbonText, { color: '#000' }]}>EN POPÜLER</Text>
                            </View>
                        )}
                        {isCheapest && !isPopular && (
                            <View style={[styles.ribbon, { backgroundColor: STORE_THEME.colors.primaryGradient[0] }]}>
                                <Text style={styles.ribbonText}>EN AVANTAJLI</Text>
                            </View>
                        )}
                    </View>

                    {/* Coin Image */}
                    <View style={styles.coinImageContainer}>
                        <Image
                            source={require('../../assets/gold_coin_3f.png')}
                            style={[styles.coinImage, { transform: [{ scale: coinScale }] }]}
                            resizeMode="contain"
                        />
                    </View>

                    {/* Coin Count */}
                    <View style={styles.packageInfo}>
                        <Text style={[styles.coinCount, { color: isPopular ? STORE_THEME.colors.accentGold : STORE_THEME.colors.textWhite }]}>
                            {coinAmount.toLocaleString('tr-TR')}
                        </Text>
                        <Text style={styles.coinLabel}>
                            COIN
                        </Text>
                    </View>

                    {/* Advantage Badges */}
                    <View style={styles.bonusBadgeContainer}>
                        {config.bonus > 0 && (
                            <Text style={styles.bonusBadgeText}>+%{Math.round(config.bonus / coinAmount * 100)} bonus</Text>
                        )}
                    </View>

                    {/* Price Button */}
                    <LinearGradient
                        colors={isPopular ? ['#FFC53D', '#F59E0B'] : STORE_THEME.colors.primaryGradient}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.priceButton}
                    >
                        <Text style={[styles.priceButtonText, isPopular && { color: '#000' }]}>{product.priceString}</Text>
                    </LinearGradient>
                </View>
            </TouchableOpacity>
        </Motion.SlideUp>
    );
});

export default function ShopScreen({ navigation, route }) {
    const { theme, themeMode } = useTheme();
    const { user, initialTab } = route.params || {};
    const [currentUserId, setCurrentUserId] = useState(user?.id);
    const [balance, setBalance] = useState(user?.balance || 0);
    const [offerings, setOfferings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dealer, setDealer] = useState(null);
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info' });

    const handlePurchaseIntent = (pack) => {
        handlePurchase(pack);
    };

    // Load userId from AsyncStorage if missing
    useEffect(() => {
        if (!currentUserId) {
            AsyncStorage.getItem('user').then(storedUser => {
                if (storedUser) {
                    const parsed = JSON.parse(storedUser);
                    console.log('[Shop] Loaded userId from storage:', parsed.id);
                    setCurrentUserId(parsed.id);
                    if (parsed.balance !== undefined) setBalance(parsed.balance);
                }
            });
        }
    }, []);

    // Premium Animations
    const shimmerAnim = useRef(new Animated.Value(-width)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;
    const balanceScaleAnim = useRef(new Animated.Value(1)).current;
    const continuousPulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Discrete Shimmer (Super Elegant, Extra Slow Flow)
        Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: width + 200,
                    duration: 6000, // Drastically slowed down to 6 seconds
                    useNativeDriver: true,
                }),
                Animated.delay(3000), // Adjusted delay
            ])
        ).start();

        // Continuous Floating Icon
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -10,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true,
                })
            ])
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(continuousPulse, { toValue: 1, duration: 2500, useNativeDriver: true }),
                Animated.timing(continuousPulse, { toValue: 0, duration: 2500, useNativeDriver: true })
            ])
        ).start();
    }, [shimmerAnim, floatAnim, continuousPulse]);

    useFocusEffect(
        React.useCallback(() => {
            console.log('[Shop] Focus triggered, currentUserId:', currentUserId);
            if (currentUserId) {
                AsyncStorage.getItem('token').then(token => {
                    axios.get(`${API_URL}/users/${currentUserId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                        .then(res => {
                            console.log('[Shop] Balance fetch success:', res.data.balance);
                            if (res.data && res.data.balance !== undefined) {
                                setBalance(res.data.balance);
                                // Also update stored user for consistency
                                AsyncStorage.getItem('user').then(storedUser => {
                                    if (storedUser) {
                                        const parsed = JSON.parse(storedUser);
                                        parsed.balance = res.data.balance;
                                        AsyncStorage.setItem('user', JSON.stringify(parsed));
                                    }
                                });
                            }
                        })
                        .catch(err => console.log('[Shop] Balance sync error:', err.message));
                });
            }
        }, [currentUserId])
    );

    // Pulse balance when it changes
    useEffect(() => {
        Animated.sequence([
            Animated.timing(balanceScaleAnim, {
                toValue: 1.2,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.spring(balanceScaleAnim, {
                toValue: 1,
                friction: 4,
                useNativeDriver: true,
            })
        ]).start();
    }, [balance]);

    useEffect(() => {
        const fetchOfferings = async () => {
            setLoading(true);
            try {
                const token = await AsyncStorage.getItem('token');
                const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

                // 1. Fetch live backend packages
                let backendPackages = [];
                try {
                    const res = await axios.get(`${API_URL}/offerings`, { headers: authHeader });
                    if (Array.isArray(res.data)) {
                        backendPackages = res.data;
                    }
                } catch (e) {
                    console.log('[Shop] Backend offerings fetch error:', e.message);
                }

                // 2. Fetch RevenueCat offerings
                let availablePackages = [];
                try {
                    availablePackages = await PurchaseService.getOfferings() || [];
                } catch (e) {
                    console.log('[Shop] RevenueCat offerings fetch error:', e.message);
                }

                // Filter out Starter Packs and Premium subscription packages
                const filteredRC = availablePackages.filter(p => 
                    !p.product.identifier.toLowerCase().includes('starter') &&
                    !p.product.title.toLowerCase().includes('başlangıç') &&
                    !p.product.identifier.toLowerCase().includes('premium')
                );

                // Map of RevenueCat product identifiers that are active
                const rcIdentifiers = new Set(
                    filteredRC.map(p => p.product.identifier.toLowerCase())
                );

                // Start with RevenueCat packages
                const mergedList = [...filteredRC];
                
                // Add backend packages whose revenuecat_id is NOT in RevenueCat active offerings
                backendPackages.forEach(pkg => {
                    const rcId = (pkg.revenuecat_id || '').toLowerCase();
                    const coinCount = parseInt(pkg.coins, 10);
                    // Skip if this exact product is already returned from RevenueCat
                    if (coinCount > 0 && (!rcId || !rcIdentifiers.has(rcId))) {
                        mergedList.push({
                            isLocal: true,
                            product: {
                                identifier: pkg.revenuecat_id || `local_${pkg.coins}`,
                                title: `${pkg.coins} Coin`,
                                description: pkg.name || 'Altın Paketi',
                                priceString: `₺${parseFloat(pkg.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
                                price: parseFloat(pkg.price),
                                coins: pkg.coins
                            }
                        });
                    }
                });

                // Sort all packages by coin count (ascending)
                mergedList.sort((a, b) => {
                    const amountA = parseInt(a.product.title ? a.product.title.split(' ')[0] : a.product.coins, 10) || 0;
                    const amountB = parseInt(b.product.title ? b.product.title.split(' ')[0] : b.product.coins, 10) || 0;
                    return amountA - amountB;
                });

                setOfferings(mergedList);

                // Fetch Dealer Profile (gender: coin_bayisi)
                const opRes = await axios.get(`${API_URL}/operators?limit=50`, { headers: authHeader });
                if (Array.isArray(opRes.data)) {
                    const coinDealer = opRes.data.find(op => op.gender === 'coin_bayisi');
                    if (coinDealer) {
                        setDealer(coinDealer);
                    }
                }
            } catch (err) {
                console.error('[Shop] Fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchOfferings();
    }, []);

    const handleDealerPress = () => {
        if (dealer) {
            navigation.navigate('OperatorProfile', { operator: dealer, user: { id: currentUserId } });
        } else {
            // Fallback if dealer not found in list
            navigation.navigate('CoinDealer', { user: { id: currentUserId } });
        }
    };

    const handlePurchase = async (pack) => {
        try {
            let transactionId = `test_${Date.now()}`;
            let success = false;

            if (pack.isLocal) {
                // Try purchasing directly via product identifier on RevenueCat / Google Play
                const directRes = await PurchaseService.purchaseProductByIdentifier(pack.product.identifier);
                if (directRes.success) {
                    success = true;
                    transactionId = directRes.transactionId || transactionId;
                } else if (directRes.cancelled) {
                    return;
                } else {
                    setAlertConfig({
                        visible: true,
                        title: 'Ödeme Bağlantısı',
                        message: `"${pack.product.title}" paketi Google Play Console ve RevenueCat sisteminde yayına alındığında ödeme ekranı açılacaktır.`,
                        type: 'info'
                    });
                    return;
                }
            } else {
                const result = await PurchaseService.purchasePackage(pack);
                if (result.success) {
                    success = true;
                    transactionId = result.transactionId || transactionId;
                } else if (result.pending) {
                    setAlertConfig({
                        visible: true,
                        title: 'Ödeme İşleniyor',
                        message: 'Ödemeniz şu an beklemede. Onaylandığında bakiyeniz otomatik olarak güncellenecektir. Lütfen bekleyiniz.',
                        type: 'info'
                    });
                    return;
                } else if (!result.cancelled) {
                    let errorMessage = 'Satın alma işlemi şu an gerçekleştirilemiyor. Lütfen daha sonra tekrar deneyiniz.';
                    if (result.error?.includes('not allowed')) {
                        errorMessage = 'Cihazınız veya hesabınız satın alma işlemine izin vermiyor. Lütfen kısıtlamaları kontrol edin.';
                    } else if (result.error?.includes('network')) {
                        errorMessage = 'Bağlantı hatası oluştu. Lütfen internetinizi kontrol edip tekrar deneyin.';
                    }
                    setAlertConfig({
                        visible: true,
                        title: 'İşlem Başarısız',
                        message: errorMessage,
                        type: 'error'
                    });
                    return;
                } else {
                    return;
                }
            }

            if (success) {
                // Webhook already added coins to the balance — just fetch the updated balance.
                const token = user?.token || await AsyncStorage.getItem('token');
                let liveBalance = 0;

                // Wait briefly for webhook to process before fetching balance
                await new Promise(resolve => setTimeout(resolve, 2000));

                try {
                    const balRes = await axios.get(`${API_URL}/users/balance`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (balRes.data && balRes.data.balance !== undefined) {
                        liveBalance = balRes.data.balance;
                    }
                } catch (syncError) {
                    console.error('[SHOP] Balance fetch error after purchase:', syncError.message);
                }

                // Force update UI and storage
                setBalance(liveBalance || 0);

                // Update stored user object as well
                const storedUser = await AsyncStorage.getItem('user');
                if (storedUser) {
                    const parsed = JSON.parse(storedUser);
                    parsed.balance = liveBalance;
                    parsed.hearts = liveBalance;
                    await AsyncStorage.setItem('user', JSON.stringify(parsed));
                }

                setAlertConfig({
                    visible: true,
                    title: 'Tebrikler!',
                    message: `Satın alım başarılı. \nYeni Bakiye: ${liveBalance}`,
                    type: 'success'
                });
            }
        } catch (error) {
            console.error('Purchase Error:', error);
            const details = error.response?.data?.details || error.response?.data?.error || error.message;
            alert('Beklenmedik bir hata oluştu: ' + details);
        }
    };

    let cheapestPackId = null;
    let minRate = Infinity;
    offerings.forEach(pack => {
        const coinAmountStr = pack.product.title ? pack.product.title.split(' ')[0] : (pack.product.coins || '0');
        const coinAmount = parseInt(coinAmountStr, 10) || 0;
        const price = pack.product.price;
        if (coinAmount > 0 && price > 0) {
            const rate = price / coinAmount;
            if (rate < minRate) {
                minRate = rate;
                cheapestPackId = pack.product.identifier;
            }
        }
    });

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={themeMode === 'dark' ? "light-content" : "dark-content"} />
            <LinearGradient 
                colors={themeMode === 'dark' ? ['#2D0B16', '#1A050B', '#140307'] : ['#fdf2f8', '#fae8ff', '#f3e8ff']} 
                style={StyleSheet.absoluteFill} 
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: theme.colors.glass }]}>
                        <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Coin Mağazası</Text>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                    {/* Modern Animated Balance Card */}
                    <View style={[styles.balanceCard, { backgroundColor: 'rgba(255, 197, 61, 0.08)', borderColor: STORE_THEME.colors.accentGold, borderWidth: 1 }]}>
                        {/* Shimmer Effect Layer */}
                        <Animated.View style={[
                            styles.shimmerLayer,
                            { transform: [{ translateX: shimmerAnim }, { rotate: '25deg' }] }
                        ]}>
                            <LinearGradient
                                colors={['transparent', 'rgba(255,255,255,0.45)', 'transparent']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={StyleSheet.absoluteFill}
                            />
                        </Animated.View>

                        <View style={styles.balanceInfo}>
                            <Text style={styles.balanceLabel}>Mevcut Bakiyen</Text>
                            <Animated.Text style={[
                                styles.balanceValue,
                                { color: STORE_THEME.colors.accentGold },
                                { 
                                    transform: [
                                        { scale: balanceScaleAnim },
                                        { 
                                            scale: continuousPulse.interpolate({ 
                                                inputRange: [0, 1], 
                                                outputRange: balance >= 20000 ? [1, 1.08] : balance >= 10000 ? [1, 1.03] : [1, 1] 
                                            })
                                        }
                                    ] 
                                }
                            ]}>
                                {Number(balance).toLocaleString('tr-TR')}
                            </Animated.Text>
                        </View>

                        <Animated.View style={[
                            styles.balanceIconWrapper,
                            { transform: [{ translateY: floatAnim }] }
                        ]}>
                            <Image
                                source={require('../../assets/gold_coin_3f.png')}
                                style={{ width: 65, height: 65 }}
                                resizeMode="contain"
                            />
                        </Animated.View>
                    </View>

                    {/* Dealer Promotion Moved to Top */}
                    <Motion.SlideUp delay={200}>
                        <TouchableOpacity
                            onPress={handleDealerPress}
                            style={[styles.dealerPromoContainer, { marginBottom: 24 }]}
                        >
                            <View style={[styles.dealerPromo, { backgroundColor: STORE_THEME.colors.surfaceDark, borderColor: STORE_THEME.colors.surfaceDarkBorder, borderWidth: 1 }]}>
                                <View style={styles.dealerPromoIcon}>
                                    <Ionicons name="diamond" size={24} color={STORE_THEME.colors.primaryGradient[0]} />
                                </View>
                                <View style={styles.dealerPromoInfo}>
                                    <Text style={[styles.dealerPromoTitle, { color: STORE_THEME.colors.textWhite, fontSize: 14 }]}>Resmi Bayi</Text>
                                    <Text style={[styles.dealerPromoDesc, { color: STORE_THEME.colors.textMuted, fontSize: 12 }]}>Alternatif ödeme yöntemleriyle bayi üzerinden coin alabilirsiniz.</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={STORE_THEME.colors.textMuted} />
                            </View>
                        </TouchableOpacity>
                    </Motion.SlideUp>

                    <Text style={[styles.sectionTitle, { color: STORE_THEME.colors.textWhite }]}>Coin Paketleri</Text>
                    <Text style={[styles.sectionSub, { color: STORE_THEME.colors.textMuted }]}>Coin ile mesaj gönder, hediye yolla, profilini öne çıkar.</Text>

                    <View style={styles.packagesGrid}>
                        {loading ? (
                            <View style={{ paddingVertical: 40, alignItems: 'center', width: '100%' }}>
                                <Text style={{ color: STORE_THEME.colors.textMuted }}>Paketler yükleniyor...</Text>
                            </View>
                        ) : offerings.length > 0 ? (
                            offerings.map((pack, index) => {
                                const cAmount = parseInt(pack.product.title ? pack.product.title.split(' ')[0] : (pack.product.coins || '0'), 10);
                                return (
                                    <CoinPackageCard
                                        key={pack.product.identifier}
                                        pack={pack}
                                        index={index}
                                        handlePurchaseIntent={handlePurchaseIntent}
                                        isPopular={cAmount === 1200}
                                        isCheapest={pack.product.identifier === cheapestPackId}
                                    />
                                );
                            })
                        ) : (
                            [
                                { coins: 100, price: '54,99 ₺', numPrice: 54.99, name: 'Küçük Paket' },
                                { coins: 250, price: '120,99 ₺', numPrice: 120.99, name: 'Gümüş Paket' },
                                { coins: 500, price: '219,99 ₺', numPrice: 219.99, name: 'Altın Paket' },
                                { coins: 1000, price: '395,99 ₺', numPrice: 395.99, name: 'VIP Paket' },
                                { coins: 2500, price: '1299,99 ₺', numPrice: 1299.99, name: 'Platin Paket' },
                                { coins: 5000, price: '2399,99 ₺', numPrice: 2399.99, name: 'Efsane Paket' }
                            ].map((p, i) => (
                                <CoinPackageCard
                                    key={`fallback_${i}`}
                                    pack={{
                                        isLocal: true,
                                        product: {
                                            identifier: `fallback_${i}`,
                                            title: `${p.coins} Coin`,
                                            description: p.name,
                                            priceString: p.price,
                                            price: p.numPrice,
                                            coins: p.coins
                                        }
                                    }}
                                    index={i}
                                    handlePurchaseIntent={handlePurchaseIntent}
                                    isPopular={p.coins === 1200}
                                    isCheapest={p.coins === 5000}
                                />
                            ))
                        )}
                    </View>
                </ScrollView>
                <ModernAlert
                    visible={alertConfig.visible}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    type={alertConfig.type}
                    onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
                />
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        height: 70,
        marginTop: Platform.OS === 'ios' ? 0 : 25, // Extra margin for Android status bar
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    scroll: {
        padding: 16,
        paddingBottom: 40,
    },
    balanceCard: {
        height: 100,
        borderRadius: 24,
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        overflow: 'hidden',
    },
    balanceInfo: {
        zIndex: 2,
    },
    balanceLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 2,
    },
    balanceValue: {
        fontSize: 32,
        fontWeight: '900',
    },
    shimmerLayer: {
        position: 'absolute',
        top: -150,
        left: -150,
        height: 500,
        width: 140,
        zIndex: 1,
    },
    balanceIconWrapper: {
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    sectionSub: {
        fontSize: 12,
        marginBottom: 16,
    },
    packagesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 10,
    },
    cardContainer: {
        width: (width - 52) / 3,
        marginBottom: 4,
    },
    bestValueContainer: {
        transform: [{ scale: 1.02 }],
        zIndex: 5,
    },
    card: {
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        minHeight: 155,
        justifyContent: 'space-between',
    },
    bestValueCard: {
        borderColor: '#fbbf24',
        borderWidth: 1.5,
    },
    ribbonContainer: {
        position: 'absolute',
        top: -8,
        alignItems: 'center',
        width: '100%',
        zIndex: 10,
    },
    ribbon: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5,
        alignItems: 'center'
    },
    ribbonText: {
        color: '#fff',
        fontSize: 7,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    coinImageContainer: {
        height: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    coinImage: {
        width: 30,
        height: 30,
    },
    packageInfo: {
        alignItems: 'center',
        marginVertical: 2,
    },
    coinCount: {
        fontSize: 16,
        fontWeight: '900',
        lineHeight: 20,
    },
    coinLabel: {
        fontSize: 8,
        fontWeight: '700',
        opacity: 0.6,
        letterSpacing: 1,
        color: '#C5B3B8',
    },
    bonusBadge: {
        backgroundColor: '#16a34a',
        borderRadius: 6,
        paddingHorizontal: 5,
        paddingVertical: 2,
        marginTop: 2,
    },
    bonusBadgeText: {
        color: '#ffffff',
        fontSize: 7,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    totalCoinsText: {
        fontSize: 7.5,
        fontWeight: '600',
        opacity: 0.65,
        marginBottom: 1,
    },
    priceButton: {
        paddingVertical: 5,
        paddingHorizontal: 4,
        borderRadius: 10,
        width: '85%',
        alignItems: 'center',
    },
    priceButtonText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '800',
    },
    dealerPromoContainer: {
        marginTop: 0,
        marginBottom: 16,
    },
    dealerPromo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    dealerPromoIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    dealerPromoInfo: {
        flex: 1,
    },
    dealerPromoTitle: {
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 1,
    },
    dealerPromoDesc: {
        fontSize: 11,
        opacity: 0.7,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1A050B',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderBottomWidth: 0,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    modalMessage: {
        fontSize: 16,
        color: '#C5B3B8',
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    modalCancelText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    modalConfirmBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#FF3D6E',
        alignItems: 'center',
    },
    modalConfirmText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    badgeRow: {
        width: '100%',
        alignItems: 'center',
        position: 'absolute',
        top: -8,
        zIndex: 10,
    },
    bonusBadgeContainer: {
        alignItems: 'center',
        gap: 2,
        marginVertical: 4,
        minHeight: 16,
    }
});
