import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, SafeAreaView, Dimensions, StatusBar, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

export default function ShopScreen({ navigation, route }) {
    const { theme, themeMode } = useTheme();
    const { user, initialTab } = route.params || {};
    const TEST_USER_ID = 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b';
    const currentUserId = user?.id || TEST_USER_ID;
    const [balance, setBalance] = React.useState(user?.balance || 0);

    const handlePurchase = async (item) => {
        const priceStr = item.price.replace(' ₺', '').replace('.', '').replace(',', '.');
        const price = parseFloat(priceStr);

        try {
            const res = await axios.post(`${API_URL}/purchase`, {
                userId: currentUserId,
                amount: price,
                coins: item.coins
            });

            if (res.data.success) {
                setBalance(res.data.balance);
                alert(`Satın Alındı! \nYeni Bakiye: ${res.data.balance}`);
            }
        } catch (error) {
            console.error(error);
            alert('Satın alma hatası');
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

    const renderCoinCard = (item, index) => (
        <TouchableOpacity
            key={index}
            style={[styles.cardContainer, item.bestValue && styles.bestValueContainer]}
            onPress={() => handlePurchase(item)}
            activeOpacity={0.8}
        >
            <LinearGradient
                colors={item.bestValue ? (themeMode === 'dark' ? ['#1e293b', '#0f172a'] : [theme.colors.card, theme.colors.backgroundSecondary]) : (themeMode === 'dark' ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)'] : [theme.colors.card, theme.colors.card])}
                style={[styles.card, item.bestValue && styles.bestValueCard, { borderColor: item.bestValue ? '#fbbf24' : theme.colors.glassBorder }]}
            >
                {item.bestValue && (
                    <LinearGradient
                        colors={['#fbbf24', '#f59e0b']}
                        style={styles.popularBadge}
                    >
                        <Text style={styles.popularBadgeText}>EN POPÜLER</Text>
                    </LinearGradient>
                )}

                <LinearGradient
                    colors={item.color}
                    style={styles.iconCircle}
                >
                    <Ionicons name={item.icon} size={26} color="white" />
                </LinearGradient>

                <View style={styles.cardInfo}>
                    <Text style={[styles.coinCount, { color: theme.colors.text }]}>{item.coins} Coin</Text>
                    <Text style={[styles.coinLabel, { color: theme.colors.textSecondary }]}>Altın Paketi</Text>
                </View>

                <View style={[styles.priceContainer, { backgroundColor: theme.colors.glass }]}>
                    <Text style={[styles.priceValue, { color: theme.colors.text }]}>{item.price}</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );

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
                        {coinPackages.map(renderCoinCard)}
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
