import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, SafeAreaView, Dimensions, StatusBar, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { PurchaseService } from '../services/purchaseService';
import { useEffect, useState } from 'react';

const { width } = Dimensions.get('window');

export default function ShopScreen({ navigation, route }) {
    const { theme, themeMode } = useTheme();
    const { user, initialTab } = route.params || {};
    const TEST_USER_ID = 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b';
    const currentUserId = user?.id || TEST_USER_ID;
    const [balance, setBalance] = useState(user?.balance || 0);
    const [offerings, setOfferings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOfferings = async () => {
            setLoading(true);
            try {
                // 1. Try RevenueCat
                const availablePackages = await PurchaseService.getOfferings();

                if (availablePackages && availablePackages.length > 0) {
                    setOfferings(availablePackages);
                } else {
                    // 2. Fallback to our Backend
                    console.log('[Shop] No RevenueCat offerings found, falling back to backend API.');
                    const res = await axios.get(`${API_URL}/api/public/packages`);
                    // Transform DB packages to a compatible format for render
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
            } catch (err) {
                console.error('[Shop] Error loading offerings:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchOfferings();
    }, []);

    const handlePurchase = async (pack) => {
        try {
            let transactionId = `test_${Date.now()}`;
            let success = false;

            if (pack.isLocal && !pack.product.identifier.includes('_')) {
                // Fallback for old integer IDs if revenuecat_id is missing (still Test Mode for legacy)
                // But ideally we want real purchase. 
                // If identifier is "coins_100", PurchaseService might work if configured in Store.
            }

            // Always try real purchase (RevenueCat)
            // Even if isLocal=true, we now use revenuecat_id as identifier
            const result = await PurchaseService.purchasePackage(pack);
            if (result.success) {
                success = true;
                transactionId = result.customerInfo.allPurchaseDates[pack.product.identifier] || transactionId;
            } else if (!result.cancelled) {
                alert('Satın alma işlemi başarısız: ' + result.error);
                return;
            }

            if (success) {
                // Sync with backend
                const res = await axios.post(`${API_URL}/api/purchase`, {
                    userId: currentUserId,
                    productId: pack.product.identifier,
                    transactionId: transactionId
                });

                if (res.data.success || res.status === 200) {
                    // Backend returns updated user fields usually, or we refetch
                    // The backend snippet showed updating balance, but verify logic
                    if (res.data.balance !== undefined) {
                        setBalance(res.data.balance);
                        alert(`Tebrikler! Satın alım başarılı. \nYeni Bakiye: ${res.data.balance}`);
                    } else {
                        // Fallback refetch
                        const userRes = await axios.get(`${API_URL}/users/${currentUserId}`);
                        setBalance(userRes.data.balance);
                        alert('Satın alım başarılı! Bakiyeniz güncellendi.');
                    }
                }
            }
        } catch (error) {
            console.error('Purchase Error:', error);
            alert('Beklenmedik bir hata oluştu: ' + (error.response?.data?.error || error.message));
        }
    };

    const coinPackages = [
        { coins: 100, price: '39,99 ₺', icon: 'cube-outline', color: ['#60a5fa', '#3b82f6'] },
        { coins: 200, price: '69,99 ₺', icon: 'flash', bestValue: true, color: ['#fbbf24', '#f59e0b'] },
        { coins: 400, price: '129,99 ₺', icon: 'diamond-outline', color: ['#e879f9', '#d946ef'] },
        { coins: 700, price: '249,99 ₺', icon: 'diamond', color: ['#8b5cf6', '#7c3aed'] },
        { coins: 1200, price: '449,99 ₺', icon: 'rocket-outline', color: ['#2dd4bf', '#0d9488'] },
        { coins: 2500, price: '949,99 ₺', icon: 'rocket', color: ['#fb7185', '#e11d48'] },
        { coins: 5000, price: '1749,99 ₺', icon: 'trophy', color: ['#fcd34d', '#b45309'] },
    ];

    const renderCoinCard = (pack, index) => {
        const product = pack.product;
        // Map common icons based on price or identifier as a fallback
        const isBestValue = product.identifier.includes('popular') || index === 1;

        const handlePress = () => {
            handlePurchase(pack);
        };

        return (
            <TouchableOpacity
                key={product.identifier}
                style={[styles.cardContainer, isBestValue && styles.bestValueContainer]}
                onPress={handlePress}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={isBestValue ? (themeMode === 'dark' ? ['#1e293b', '#0f172a'] : ['#fef3c7', '#fffbeb']) : (themeMode === 'dark' ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)'] : [theme.colors.card, theme.colors.card])}
                    style={[styles.card, isBestValue && styles.bestValueCard, { borderColor: isBestValue ? '#fbbf24' : theme.colors.glassBorder }]}
                >
                    {isBestValue && (
                        <LinearGradient
                            colors={['#fbbf24', '#f59e0b']}
                            style={styles.popularBadge}
                        >
                            <Text style={styles.popularBadgeText}>EN POPÜLER</Text>
                        </LinearGradient>
                    )}

                    <LinearGradient
                        colors={index % 3 === 0 ? ['#8b5cf6', '#7c3aed'] : index % 3 === 1 ? ['#fbbf24', '#f59e0b'] : ['#e879f9', '#d946ef']}
                        style={styles.iconCircle}
                    >
                        <Ionicons name={index % 2 === 0 ? "cube-outline" : "diamond-outline"} size={26} color="white" />
                    </LinearGradient>

                    <View style={styles.cardInfo}>
                        <Text style={[styles.coinCount, { color: theme.colors.text }]}>{product.title}</Text>
                        <Text style={[styles.coinLabel, { color: theme.colors.textSecondary }]}>{product.description || 'Altın Paketi'}</Text>
                    </View>

                    <View style={[styles.priceContainer, { backgroundColor: theme.colors.glass }]}>
                        <Text style={[styles.priceValue, { color: theme.colors.text }]}>{product.priceString}</Text>
                        <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

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

                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Coin Paketleri</Text>
                    <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>Daha fazla etkileşim için hesabına coin yükle.</Text>

                    <View style={styles.packagesGrid}>
                        {loading ? (
                            <View style={{ py: 40, alignItems: 'center' }}>
                                <Text style={{ color: theme.colors.textSecondary }}>Paketler yükleniyor...</Text>
                            </View>
                        ) : offerings.length > 0 ? (
                            offerings.map(renderCoinCard)
                        ) : (
                            // Absolute Fallback if even API fails
                            [
                                { coins: 100, price: '39,99 ₺', name: 'Başlangıç Paketi' },
                                { coins: 250, price: '89,99 ₺', name: 'Gümüş Paket' },
                                { coins: 500, price: '159,99 ₺', name: 'Altın Paket' },
                                { coins: 1000, price: '299,99 ₺', name: 'VIP Paket' },
                                { coins: 2500, price: '699,99 ₺', name: 'Platin Paket' },
                                { coins: 5000, price: '1299,99 ₺', name: 'Efsane Paket' }
                            ].map((p, i) => renderCoinCard({
                                isLocal: true,
                                product: {
                                    identifier: `fallback_${i}`,
                                    title: `${p.coins} Coin`,
                                    description: p.name,
                                    priceString: p.price
                                }
                            }, i))
                        )}
                    </View>
                </ScrollView>
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
        gap: 15,
    },
    cardContainer: {
        borderRadius: 24,
        overflow: 'visible',
    },
    bestValueContainer: {
        marginTop: 10,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 24,
        borderWidth: 1,
    },
    bestValueCard: {
        borderColor: '#fbbf24',
        borderWidth: 2,
    },
    popularBadge: {
        position: 'absolute',
        top: -12,
        right: 25,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 10,
        zIndex: 10,
    },
    popularBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '900',
    },
    iconCircle: {
        width: 54,
        height: 54,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    cardInfo: {
        flex: 1,
        marginLeft: 15,
    },
    coinCount: {
        fontSize: 18,
        fontWeight: '800',
    },
    coinLabel: {
        fontSize: 12,
        marginTop: 2,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        gap: 4,
    },
    priceValue: {
        fontWeight: '800',
        fontSize: 14,
    },
});
