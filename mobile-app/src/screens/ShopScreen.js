import React from 'react';
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

const { width } = Dimensions.get('window');

const CoinPackageCard = ({ pack, index, handlePurchase, theme, themeMode }) => {
    const product = pack.product;
    const coinAmount = product.title.split(' ')[0] || product.title;
    const isBestValue = product.identifier.includes('popular') || coinAmount === '1200';

    const floatAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Floating animation for coins
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -8, // move up
                    duration: 1200 + (index % 3) * 200, // slight offset per card
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 1200 + (index % 3) * 200,
                    useNativeDriver: true,
                })
            ])
        ).start();

        // Pulsing animation for "best value" badge/button
        if (isBestValue) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    })
                ])
            ).start();
        }
    }, [floatAnim, pulseAnim, index, isBestValue]);

    return (
        <Motion.SlideUp delay={index * 100}>
            <TouchableOpacity
                style={[styles.cardContainer, isBestValue && styles.bestValueContainer]}
                onPress={() => handlePurchase(pack)}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={isBestValue ? (themeMode === 'dark' ? ['#451a03', '#2e1f08'] : ['#fef3c7', '#fffbeb']) : (themeMode === 'dark' ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.01)'] : [theme.colors.card, theme.colors.card])}
                    style={[styles.card, isBestValue && styles.bestValueCard]}
                >
                    {isBestValue && (
                        <View style={styles.ribbonContainer}>
                            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                <LinearGradient colors={['#fbbf24', '#f59e0b']} style={styles.ribbon}>
                                    <Text style={styles.ribbonText}>POPÜLER</Text>
                                </LinearGradient>
                            </Animated.View>
                        </View>
                    )}

                    <View style={styles.coinImageContainer}>
                        <Animated.Image
                            source={require('../../assets/gold_coin_3f.png')}
                            style={[styles.coinImage, { transform: [{ translateY: floatAnim }] }]}
                            resizeMode="contain"
                        />
                    </View>

                    <Text style={[styles.coinCount, { color: isBestValue ? '#fbbf24' : theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                        {coinAmount}
                    </Text>
                    <Text style={[styles.coinLabel, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        Coin
                    </Text>

                    <Animated.View style={[{ width: '100%', alignItems: 'center' }, isBestValue ? { transform: [{ scale: pulseAnim }] } : {}]}>
                        <LinearGradient
                            colors={isBestValue ? ['#fbbf24', '#f59e0b'] : ['#ec4899', '#e11d48']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={styles.priceButton}
                        >
                            <Text style={styles.priceButtonText} numberOfLines={1} adjustsFontSizeToFit>{product.priceString}</Text>
                        </LinearGradient>
                    </Animated.View>
                </LinearGradient>
            </TouchableOpacity>
        </Motion.SlideUp>
    );
};

export default function ShopScreen({ navigation, route }) {
    const { theme, themeMode } = useTheme();
    const { user, initialTab } = route.params || {};
    const currentUserId = user?.id; // Removed hardcoded TEST_USER_ID fallback
    const [balance, setBalance] = useState(user?.balance || 0);
    const [offerings, setOfferings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dealer, setDealer] = useState(null);
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info' });

    useEffect(() => {
        const fetchOfferings = async () => {
            setLoading(true);
            try {
                // Fetch offerings
                const availablePackages = await PurchaseService.getOfferings();
                if (availablePackages && availablePackages.length > 0) {
                    // Sort packages by coin amount (ascending)
                    const sortedPackages = [...availablePackages].sort((a, b) => {
                        const amountA = parseInt(a.product.title.split(' ')[0], 10) || 0;
                        const amountB = parseInt(b.product.title.split(' ')[0], 10) || 0;
                        return amountA - amountB;
                    });
                    setOfferings(sortedPackages);
                } else {
                    const res = await axios.get(`${API_URL}/offerings`);
                    const transformed = res.data.map(pkg => ({
                        isLocal: true,
                        product: {
                            identifier: pkg.revenuecat_id || pkg.id.toString(),
                            title: `${pkg.coins} Coin`,
                            description: pkg.name || 'Altın Paketi',
                            priceString: `${pkg.price} ₺`,
                            price: pkg.price,
                            coins: pkg.coins
                        }
                    }));
                    setOfferings(transformed);
                }

                // Fetch Dealer Profile (gender: coin_bayisi)
                const opRes = await axios.get(`${API_URL}/operators?limit=50`);
                const coinDealer = opRes.data.find(op => op.gender === 'coin_bayisi');
                if (coinDealer) {
                    setDealer(coinDealer);
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
                alert('Test satışı kapalı. Ürünler App Store / Play Store üzerinden çekilemedi.');
                return;
            }

            const result = await PurchaseService.purchasePackage(pack);
            if (result.success) {
                success = true;
                // Try to get real transaction ID if available
                transactionId = result.customerInfo?.originalAppUserId || transactionId;
            } else if (result.pending) {
                // Payment is pending (e.g., slow test payment or bank transfer)
                setAlertConfig({
                    visible: true,
                    title: 'Ödeme Beklemede',
                    message: result.error || 'Ödemeniz inceleniyor, onaylandığında bakiyeniz eklenecektir.',
                    type: 'info'
                });
                return;
            } else if (!result.cancelled) {
                setAlertConfig({
                    visible: true,
                    title: 'Hata',
                    message: 'Satın alma işlemi başarısız: ' + result.error,
                    type: 'error'
                });
                return;
            } else {
                // User cancelled the purchase
                return;
            }

            if (success) {
                // Sync with backend
                const token = user?.token || await AsyncStorage.getItem('token');
                const res = await axios.post(`${API_URL}/purchase`, {
                    userId: currentUserId,
                    productId: pack.product.identifier,
                    transactionId: transactionId
                }, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.data.success || res.status === 200) {
                    // Refetch the full user profile to ensure balance, VIP levels, and XP are all synced
                    const token = user?.token || await AsyncStorage.getItem('token');
                    const userRes = await axios.get(`${API_URL}/me`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (userRes.data) {
                        setBalance(userRes.data.balance || 0);
                        setAlertConfig({
                            visible: true,
                            title: 'Tebrikler!',
                            message: `Satın alım başarılı. \nYeni Bakiye: ${userRes.data.balance}`,
                            type: 'success'
                        });
                    } else {
                        // Success but couldn't refetch, use the partial data from purchase response
                        setBalance(res.data.balance);
                        setAlertConfig({
                            visible: true,
                            title: 'Tebrikler!',
                            message: `Satın alım başarılı. \nYeni Bakiye: ${res.data.balance}`,
                            type: 'success'
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Purchase Error:', error);
            const details = error.response?.data?.details || error.response?.data?.error || error.message;
            alert('Beklenmedik bir hata oluştu: ' + details);
        }
    };

    const coinPackages = [
        { coins: 100, price: '49,99 ₺', icon: 'cube-outline', color: ['#60a5fa', '#3b82f6'] },
        { coins: 200, price: '89,99 ₺', icon: 'flash', bestValue: true, color: ['#fbbf24', '#f59e0b'] },
        { coins: 400, price: '159,99 ₺', icon: 'diamond-outline', color: ['#e879f9', '#d946ef'] },
        { coins: 700, price: '299,99 ₺', icon: 'diamond', color: ['#8b5cf6', '#7c3aed'] },
        { coins: 1200, price: '549,99 ₺', icon: 'rocket-outline', color: ['#2dd4bf', '#0d9488'] },
        { coins: 2500, price: '1149,99 ₺', icon: 'rocket', color: ['#fb7185', '#e11d48'] },
        { coins: 5000, price: '2099,99 ₺', icon: 'trophy', color: ['#fcd34d', '#b45309'] },
    ];



    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={themeMode === 'dark' ? "light-content" : "dark-content"} />
            <LinearGradient colors={themeMode === 'dark' ? ['#030712', '#0f172a'] : [theme.colors.background, theme.colors.backgroundSecondary]} style={StyleSheet.absoluteFill} />

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: theme.colors.glass }]}>
                        <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Coin Mağazası</Text>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                    {/* Balanced Display */}
                    <LinearGradient
                        colors={['#8b5cf6', '#d946ef']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.balanceCard}
                    >
                        <View style={styles.balanceInfo}>
                            <Text style={styles.balanceLabel}>Mevcut Bakiyen</Text>
                            <Text style={[styles.balanceValue, { color: 'white' }]}>{balance}</Text>
                        </View>
                        <View style={styles.balanceIconWrapper}>
                            <Image
                                source={require('../../assets/gold_coin_3f.png')}
                                style={{ width: 55, height: 55 }}
                                resizeMode="contain"
                            />
                        </View>
                        <View style={styles.balanceGlow} />
                    </LinearGradient>

                    {/* Dealer Promotion */}
                    <Motion.SlideUp delay={500}>
                        <TouchableOpacity
                            onPress={handleDealerPress}
                            style={styles.dealerPromoContainer}
                        >
                            <LinearGradient
                                colors={themeMode === 'dark' ? ['rgba(251, 191, 36, 0.15)', 'rgba(217, 119, 6, 0.05)'] : ['#FFFBEB', '#FEF3C7']}
                                style={styles.dealerPromo}
                            >
                                <View style={styles.dealerPromoIcon}>
                                    <Ionicons name="diamond" size={28} color="#FBBF24" />
                                </View>
                                <View style={styles.dealerPromoInfo}>
                                    <Text style={[styles.dealerPromoTitle, { color: theme.colors.text }]}>Avantajlı Paketler?</Text>
                                    <Text style={[styles.dealerPromoDesc, { color: theme.colors.textSecondary }]}>Resmi bayimizden coin alımı yapın.</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                            </LinearGradient>
                        </TouchableOpacity>
                    </Motion.SlideUp>

                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Coin Paketleri</Text>
                    <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>Daha fazla etkileşim için hesabına coin yükle.</Text>

                    <View style={styles.packagesGrid}>
                        {loading ? (
                            <View style={{ py: 40, alignItems: 'center' }}>
                                <Text style={{ color: theme.colors.textSecondary }}>Paketler yükleniyor...</Text>
                            </View>
                        ) : offerings.length > 0 ? (
                            offerings.map((pack, index) => (
                                <CoinPackageCard
                                    key={pack.product.identifier}
                                    pack={pack}
                                    index={index}
                                    handlePurchase={handlePurchase}
                                    theme={theme}
                                    themeMode={themeMode}
                                />
                            ))
                        ) : (
                            // Absolute Fallback if even API fails
                            [
                                { coins: 100, price: '49,99 ₺', name: 'Başlangıç Paketi' },
                                { coins: 250, price: '109,99 ₺', name: 'Gümüş Paket' },
                                { coins: 500, price: '199,99 ₺', name: 'Altın Paket' },
                                { coins: 1000, price: '359,99 ₺', name: 'VIP Paket' },
                                { coins: 2500, price: '849,99 ₺', name: 'Platin Paket' },
                                { coins: 5000, price: '1599,99 ₺', name: 'Efsane Paket' }
                            ].map((p, i) => (
                                <CoinPackageCard
                                    key={`fallback_${i}`}
                                    pack={{
                                        isLocal: true,
                                        product: {
                                            identifier: `fallback_${i}`,
                                            title: `${p.coins} Coin`,
                                            description: p.name,
                                            priceString: p.price
                                        }
                                    }}
                                    index={i}
                                    handlePurchase={handlePurchase}
                                    theme={theme}
                                    themeMode={themeMode}
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
        height: 60,
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
        padding: 20,
        paddingBottom: 40,
    },
    balanceCard: {
        height: 120,
        borderRadius: 30,
        padding: 25,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    balanceInfo: {
        zIndex: 2,
    },
    balanceLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    balanceValue: {
        fontSize: 36,
        fontWeight: '900',
    },
    balanceIconWrapper: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    balanceGlow: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'white',
        opacity: 0.1,
        zIndex: 1,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 8,
    },
    sectionSub: {
        fontSize: 14,
        marginBottom: 25,
    },
    packagesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 18,
        paddingHorizontal: 0,
    },
    cardContainer: {
        width: (width - 64) / 3, // Absolute pixels fix for Animated.View wrapping bug
        overflow: 'visible',
    },
    bestValueContainer: {
        transform: [{ scale: 1.05 }],
        zIndex: 5,
    },
    card: {
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)', // Slightly brighter border for glass effect
        minHeight: 160,
        justifyContent: 'space-between',
    },
    bestValueCard: {
        borderColor: '#fbbf24',
        borderWidth: 2,
    },
    ribbonContainer: {
        position: 'absolute',
        top: -12,
        alignItems: 'center',
        width: '100%',
        zIndex: 10,
    },
    ribbon: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        minWidth: 80, // Prevent text squish
        alignItems: 'center'
    },
    ribbonText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    coinImageContainer: {
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 8,
    },
    coinImage: {
        width: 50,
        height: 50,
    },
    coinCount: {
        fontSize: 22, // Slightly larger font
        fontWeight: '900',
        marginBottom: -2,
    },
    coinLabel: {
        fontSize: 11,
        textTransform: 'uppercase',
        fontWeight: 'bold',
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    priceButton: {
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 20, // Fully rounded pill shape
        width: '95%',
        alignItems: 'center',
        elevation: 4, // More pronounced shadow for depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    priceButtonText: {
        color: 'white',
        fontSize: 15, // Slightly larger
        fontWeight: '900', // Extra bold
        letterSpacing: 0.5, // Better readability
    },
    dealerPromoContainer: {
        marginTop: 10,
        marginBottom: 30,
    },
    dealerPromo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
    },
    dealerPromoIcon: {
        width: 50,
        height: 50,
        borderRadius: 15,
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    dealerPromoInfo: {
        flex: 1,
    },
    dealerPromoTitle: {
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 2,
    },
    dealerPromoDesc: {
        fontSize: 13,
        opacity: 0.7,
    },
});
