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

const { width } = Dimensions.get('window');

const CoinPackageCard = ({ pack, index, handlePurchase, theme, themeMode }) => {
    const product = pack.product;
    const coinAmount = product.title.split(' ')[0] || product.title;
    const isBestValue = product.identifier.includes('popular') || coinAmount === '1200';

    return (
        <Motion.SlideUp delay={index * 50}>
            <TouchableOpacity
                style={[styles.cardContainer, isBestValue && styles.bestValueContainer]}
                onPress={() => handlePurchase(pack)}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={isBestValue ? (themeMode === 'dark' ? ['#4c1d95', '#2e1065'] : ['#fef3c7', '#fffbeb']) : (themeMode === 'dark' ? ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)'] : ['#ffffff', '#f8fafc'])}
                    style={[styles.card, isBestValue && styles.bestValueCard]}
                >
                    {isBestValue && (
                        <View style={styles.ribbonContainer}>
                            <LinearGradient colors={['#fbbf24', '#f59e0b']} style={styles.ribbon}>
                                <Text style={styles.ribbonText}>POPÜLER</Text>
                            </LinearGradient>
                        </View>
                    )}

                    <View style={styles.coinImageContainer}>
                        <Image
                            source={require('../../assets/gold_coin_3f.png')}
                            style={styles.coinImage}
                            resizeMode="contain"
                        />
                    </View>

                    <View style={styles.packageInfo}>
                        <Text style={[styles.coinCount, { color: isBestValue ? '#fbbf24' : theme.colors.text }]}>
                            {coinAmount}
                        </Text>
                        <Text style={[styles.coinLabel, { color: theme.colors.textSecondary }]}>
                            COIN
                        </Text>
                    </View>

                    <LinearGradient
                        colors={isBestValue ? ['#fbbf24', '#f59e0b'] : ['#ec4899', '#e11d48']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.priceButton}
                    >
                        <Text style={styles.priceButtonText}>{product.priceString}</Text>
                    </LinearGradient>
                </LinearGradient>
            </TouchableOpacity>
        </Motion.SlideUp>
    );
};

export default function ShopScreen({ navigation, route }) {
    const { theme, themeMode } = useTheme();
    const { user, initialTab } = route.params || {};
    const [currentUserId, setCurrentUserId] = useState(user?.id);
    const [balance, setBalance] = useState(user?.balance || 0);
    const [offerings, setOfferings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dealer, setDealer] = useState(null);
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info' });

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
    }, [shimmerAnim, floatAnim]);

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
                // Fetch offerings
                const availablePackages = await PurchaseService.getOfferings();
                if (availablePackages && availablePackages.length > 0) {
                    // Sort packages by coin amount (ascending)
                    const sortedPackages = [...availablePackages].sort((a, b) => {
                        const amountA = parseInt(a.product.title.split(' ')[0], 10) || 0;
                        const amountB = parseInt(b.product.title.split(' ')[0], 10) || 0;
                        return amountA - amountB;
                    });
                    
                    // Filter out Starter Packs from regular store
                    const filteredPackages = sortedPackages.filter(p => 
                        !p.product.identifier.toLowerCase().includes('starter') &&
                        !p.product.title.toLowerCase().includes('başlangıç')
                    );

                    setOfferings(filteredPackages);
                } else {
                    const token = await AsyncStorage.getItem('token');
                    const res = await axios.get(`${API_URL}/offerings`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
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
                const token = await AsyncStorage.getItem('token');
                const opRes = await axios.get(`${API_URL}/operators?limit=50`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
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
                setAlertConfig({
                    visible: true,
                    title: 'Mağaza Hazırlanıyor',
                    message: 'Coin paketleri şu an yükleniyor. Lütfen birkaç dakika sonra tekrar deneyin.',
                    type: 'info'
                });
                return;
            }

            const result = await PurchaseService.purchasePackage(pack);
            if (result.success) {
                success = true;
                // Try to get real transaction ID if available
                transactionId = result.customerInfo?.originalAppUserId || transactionId;
            } else if (result.pending) {
                setAlertConfig({
                    visible: true,
                    title: 'Ödeme İşleniyor',
                    message: 'Ödemeniz şu an beklemede. Onaylandığında bakiyeniz otomatik olarak güncellenecektir. Lütfen bekleyiniz.',
                    type: 'info'
                });
                return;
            } else if (!result.cancelled) {
                // Map technical errors to user-friendly Turkish
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
                    // Refetch the live balance from the dedicated endpoint
                    const token = user?.token || await AsyncStorage.getItem('token');
                    let liveBalance = res.data.balance; // Default from purchase response

                    try {
                        const balRes = await axios.get(`${API_URL}/users/balance`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (balRes.data && balRes.data.balance !== undefined) {
                            liveBalance = balRes.data.balance;
                        }
                    } catch (syncError) {
                        console.error('Balance sync error, using fallback:', syncError);
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
            }
        } catch (error) {
            console.error('Purchase Error:', error);
            const details = error.response?.data?.details || error.response?.data?.error || error.message;
            alert('Beklenmedik bir hata oluştu: ' + details);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle={themeMode === 'dark' ? "light-content" : "dark-content"} />
            <LinearGradient 
                colors={themeMode === 'dark' ? ['#0f172a', '#1e1b4b', '#4c1d95'] : ['#fdf2f8', '#fae8ff', '#f3e8ff']} 
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
                    <LinearGradient
                        colors={['#8b5cf6', '#d946ef']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.balanceCard}
                    >
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
                                { color: 'white', transform: [{ scale: balanceScaleAnim }] }
                            ]}>
                                {balance}
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
                    </LinearGradient>

                    {/* Dealer Promotion */}
                    <Motion.SlideUp delay={500}>
                        <TouchableOpacity
                            onPress={handleDealerPress}
                            style={styles.dealerPromoContainer}
                        >
                            <LinearGradient
                                colors={themeMode === 'dark' ? ['rgba(139, 92, 246, 0.2)', 'rgba(217, 70, 239, 0.1)'] : ['#F5F3FF', '#FDF2F8']}
                                style={styles.dealerPromo}
                            >
                                <View style={styles.dealerPromoIcon}>
                                    <Ionicons name="diamond" size={28} color="#d946ef" />
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
                                { coins: 100, price: '49,99 ₺', name: 'Küçük Paket' },
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
        minHeight: 130,
        justifyContent: 'space-between',
    },
    bestValueCard: {
        borderColor: '#fbbf24',
        borderWidth: 1.2,
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
});
