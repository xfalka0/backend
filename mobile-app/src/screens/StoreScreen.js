import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, Image, SafeAreaView, Dimensions, StatusBar, Platform, ActivityIndicator, Modal, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Motion } from '../components/motion/MotionSystem';
import VipFrame from '../components/ui/VipFrame';
import ModernAlert from '../components/ui/ModernAlert';
import MaskedView from '@react-native-masked-view/masked-view';
import GradientText from '../components/ui/GradientText';

import { PurchaseService } from '../services/purchaseService';

const { width } = Dimensions.get('window');

const CATEGORIES = [
    { id: 'avatar_frame', label: 'Çerçeve', icon: 'person-circle-outline', desc: 'Profil fotoğrafınızın etrafında parlayan lüks çerçeveler.' },
    { id: 'entrance_effect', label: 'Giriş', icon: 'flash-outline', desc: 'Sohbet odalarına katılırken çalacak ihtişamlı efektler.' },
    { id: 'chat_bubble', label: 'Balon', icon: 'chatbubble-ellipses-outline', desc: 'Mesajlarınızı asilleştirecek premium sohbet balonları.' },
    { id: 'profile_card', label: 'Kart', icon: 'card-outline', desc: 'Profil kartınızı süsleyecek büyüleyici temalar.' },
    { id: 'badge', label: 'Rozet', icon: 'ribbon-outline', desc: 'Karakterinizi yansıtacak özel profil rozetleri.' },
    { id: 'title', label: 'Unvan', icon: 'trophy-outline', desc: 'Adınızın hemen üstünde sergilenecek lüks unvanlar.' },
    { id: 'gift_effect', label: 'Hediye', icon: 'gift-outline', desc: 'Gönderildiğinde tam ekranda parlayacak özel hediye efektleri.' }
];

const PREMIUM_PLANS = [
    { months: 1, label: '1 Aylık Premium', subtitle: 'Premium ayrıcalıkları keşfet', badge: 'BAŞLANGIÇ', price: '449,99 ₺', productId: 'premium_1_month' },
    { months: 3, label: '3 Aylık Premium', subtitle: 'Daha uzun, daha avantajlı', badge: 'POPÜLER', price: '969,99 ₺', productId: 'premium_3_months' },
    { months: 6, label: '6 Aylık Premium', subtitle: 'En iyi değer seçeneği', badge: 'EN AVANTAJLI', price: '1499,99 ₺', productId: 'premium_6_months' },
];

const IS_MAINTENANCE_MODE = false;

export default function StoreScreen({ navigation, route }) {
    console.log("RENDER StoreScreen");
    const { theme, themeMode } = useTheme();
    const { user } = route.params || {};

    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState(user?.balance || 31100);
    const [activeTab, setActiveTab] = useState('avatar_frame');
    const [catalogItems, setCatalogItems] = useState([]);
    const [ownedItemsKeys, setOwnedItemsKeys] = useState(new Set());

    // Modal states
    const [previewItem, setPreviewItem] = useState(null);
    const [purchaseItem, setPurchaseItem] = useState(null);
    const [purchasing, setPurchasing] = useState(false);

    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info' });

    // Floating animation
    const floatAnim = useRef(new Animated.Value(0)).current;
    // Banner shimmer animation
    const bannerShimmer = useRef(new Animated.Value(0)).current;
    const bannerScale = useRef(new Animated.Value(1)).current;
    const bannerGlow = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, { toValue: -6, duration: 1500, useNativeDriver: true }),
                Animated.timing(floatAnim, { toValue: 0, duration: 1500, useNativeDriver: true })
            ])
        ).start();

        // Banner shimmer left-to-right sweep
        Animated.loop(
            Animated.timing(bannerShimmer, { toValue: 1, duration: 2200, useNativeDriver: true })
        ).start();

        // Banner gentle pulse scale
        Animated.loop(
            Animated.sequence([
                Animated.timing(bannerScale, { toValue: 1.015, duration: 1800, useNativeDriver: true }),
                Animated.timing(bannerScale, { toValue: 1, duration: 1800, useNativeDriver: true }),
            ])
        ).start();

        // Glow opacity pulse
        Animated.loop(
            Animated.sequence([
                Animated.timing(bannerGlow, { toValue: 1, duration: 1400, useNativeDriver: true }),
                Animated.timing(bannerGlow, { toValue: 0, duration: 1400, useNativeDriver: true }),
            ])
        ).start();
    }, [floatAnim]);

    if (IS_MAINTENANCE_MODE) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" />
                <LinearGradient
                    colors={['#1a0533', '#09021a']}
                    style={StyleSheet.absoluteFill}
                />

                <SafeAreaView style={styles.safeArea}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circleBtn}>
                            <Ionicons name="chevron-back" size={24} color="#ffffff" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Mağaza</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Bag')} style={styles.circleBtn}>
                            <Ionicons name="briefcase-outline" size={22} color="#FF4FA3" />
                        </TouchableOpacity>
                    </View>

                    {/* Maintenance Body */}
                    <View style={styles.maintContainer}>
                        <Motion.SlideUp delay={100} style={styles.maintCardWrapper}>
                            <LinearGradient
                                colors={['rgba(255, 79, 163, 0.12)', 'rgba(139, 92, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
                                style={styles.maintCard}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                {/* Glowing Animated Icon */}
                                <Animated.View style={{ transform: [{ translateY: floatAnim }], alignItems: 'center' }}>
                                    <View style={styles.maintIconOuter}>
                                        <LinearGradient
                                            colors={['#FF4FA3', '#8B5CFF']}
                                            style={styles.maintIconGradient}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                        >
                                            <Ionicons name="sparkles" size={40} color="#ffffff" />
                                        </LinearGradient>
                                    </View>
                                </Animated.View>

                                {/* Tag */}
                                <View style={styles.maintTag}>
                                    <Ionicons name="construct-outline" size={13} color="#FF4FA3" style={{ marginRight: 5 }} />
                                    <Text style={styles.maintTagText}>SİSTEM BAKIMDA</Text>
                                </View>

                                {/* Title */}
                                <GradientText
                                    colors={['#FFFFFF', '#F6C453']}
                                    style={styles.maintTitle}
                                >
                                    Mağaza Yenileniyor!
                                </GradientText>

                                {/* Description */}
                                <Text style={styles.maintDesc}>
                                    Sizlere daha muhteşem ve ayrıcalıklı bir deneyim sunabilmek için mağazamızı kısa bir süreliğine bakıma aldık.
                                </Text>

                                {/* Feature Preview Box */}
                                <View style={styles.maintFeatureBox}>
                                    <LinearGradient
                                        colors={['rgba(246, 196, 83, 0.12)', 'rgba(255, 79, 163, 0.08)']}
                                        style={styles.maintFeatureGradient}
                                    >
                                        <Ionicons name="gift-outline" size={22} color="#F6C453" style={{ marginBottom: 6 }} />
                                        <Text style={styles.maintFeatureTitle}>✨ Çok Yakında Neler Geliyor?</Text>
                                        <Text style={styles.maintFeatureText}>
                                            Özel profil çerçeveleri, unvanlar, animasyonlu oda giriş efektleri ve sürpriz mağaza ürünleri pek yakında sizlerin hizmetinde olacak!
                                        </Text>
                                    </LinearGradient>
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.maintActions}>
                                    <TouchableOpacity
                                        style={styles.maintPrimaryBtn}
                                        onPress={() => navigation.navigate('Bag')}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={['#FF4FA3', '#8B5CFF']}
                                            style={styles.maintBtnGradient}
                                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                        >
                                            <Ionicons name="briefcase-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                            <Text style={styles.maintBtnText}>Çantama Git</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.maintSecondaryBtn}
                                        onPress={() => navigation.goBack()}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.maintSecondaryText}>Ana Sayfaya Dön</Text>
                                    </TouchableOpacity>
                                </View>
                            </LinearGradient>
                        </Motion.SlideUp>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    // Fetch live user balance
    const fetchBalance = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (token) {
                const balRes = await axios.get(`${API_URL}/users/balance`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (balRes.data && balRes.data.balance !== undefined) {
                    setBalance(balRes.data.balance);
                }
            }
        } catch (err) {
            console.log('[STORE] Balance fetch error:', err.message);
        }
    };

    // Fetch owned items keys
    const fetchOwnedItems = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (token) {
                const res = await axios.get(`${API_URL}/store/my-inventory`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const keys = new Set(res.data.map(i => i.key));
                setOwnedItemsKeys(keys);
            }
        } catch (err) {
            console.log('[STORE] Inventory keys fetch error:', err.message);
        }
    };

    // Load catalog items depending on current active tab
    const fetchCatalog = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/store/items?category=${activeTab}`);
            setCatalogItems(res.data || []);
        } catch (err) {
            console.error('[STORE] Catalog items fetch error:', err.message);
        } finally {
            setLoading(false);
        }
    };

    // Refetch operations on focus / category switch
    useEffect(() => {
        fetchBalance();
        fetchOwnedItems();
    }, []);

    useEffect(() => {
        fetchCatalog();
    }, [activeTab]);

    const handlePremiumPurchase = async (plan) => {
        try {
            setPurchasing(true);
            // Premium paketler abonelik (SUBS) türünde — INAPP değil
            const result = await PurchaseService.purchaseProductByIdentifier(
                plan.productId,
                'SUBS' // Purchases.PURCHASE_TYPE.SUBS
            );
            if (result.success) {
                const token = await AsyncStorage.getItem('token');
                await axios.post(`${API_URL}/vip/upgrade-direct`, {
                    months: plan.months,
                    transactionId: result.customerInfo?.originalAppUserId || `rc_${Date.now()}`
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                }).catch(err => console.log('Backend sync error:', err.message));

                setAlertConfig({
                    visible: true,
                    title: 'Tebrikler! 🎉',
                    message: `${plan.label} paketiniz başarıyla aktifleştirildi. Tüm ayrıcalıkların tadını çıkarın!`,
                    type: 'success'
                });
            } else if (!result.cancelled) {
                console.warn('[STORE] Premium purchase failed:', result.error);
                setAlertConfig({
                    visible: true,
                    title: 'Ödeme Başlatılamadı',
                    message: result.error || 'Ödeme işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.',
                    type: 'error'
                });
            }
        } catch (err) {
            console.error('[STORE] Premium purchase error:', err);
            setAlertConfig({
                visible: true,
                title: 'Hata',
                message: err.message || 'Beklenmeyen bir hata oluştu.',
                type: 'error'
            });
        } finally {
            setPurchasing(false);
        }
    };

    const handlePurchase = async () => {
        if (!purchaseItem) return;
        setPurchasing(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/store/purchase`, {
                itemId: purchaseItem.id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                setBalance(res.data.newBalance);

                // Add to owned keys
                const updatedOwned = new Set(ownedItemsKeys);
                updatedOwned.add(purchaseItem.key);
                setOwnedItemsKeys(updatedOwned);

                // Update storage balance
                const storedUser = await AsyncStorage.getItem('user');
                if (storedUser) {
                    const parsed = JSON.parse(storedUser);
                    parsed.balance = res.data.newBalance;
                    parsed.hearts = res.data.newBalance;
                    await AsyncStorage.setItem('user', JSON.stringify(parsed));
                }

                setPurchaseItem(null);
                setPreviewItem(null);

                setAlertConfig({
                    visible: true,
                    title: 'Başarılı!',
                    message: `${purchaseItem.name} başarıyla satın alındı. Ürünü dilediğiniz zaman Çantam sayfasından aktifleştirebilirsiniz.`,
                    type: 'success'
                });
            }
        } catch (err) {
            console.error('[STORE] Purchase error:', err);
            const errMsg = err.response?.data?.error || 'Satın alma işlemi başarısız oldu. Lütfen daha sonra tekrar deneyiniz.';
            setAlertConfig({
                visible: true,
                title: 'Hata',
                message: errMsg,
                type: 'error'
            });
        } finally {
            setPurchasing(false);
        }
    };

    const getRarityColor = (rarity) => {
        switch (rarity) {
            case 'limited': return '#FF0055';
            case 'legendary': return '#F6C453';
            case 'epic': return '#8B5CFF';
            case 'rare': return '#4CC9FF';
            default: return '#94A3B8';
        }
    };

    const featuredItem = catalogItems.find(i => i.rarity === 'legendary' || i.rarity === 'epic') || catalogItems[0];

    const renderCatalogItem = React.useCallback(({ item, index }) => {
        const isOwned = ownedItemsKeys.has(item.key);
        return (
            <View key={item.id} style={styles.gridCardWrapper}>
                <LinearGradient
                    colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.01)']}
                    style={styles.gridCard}
                >
                    <View style={styles.gridCardTop}>
                        <View style={[styles.gridRarity, { backgroundColor: getRarityColor(item.rarity) }]}>
                            <Text style={styles.gridRarityText}>{item.rarity?.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.gridDuration}>
                            {item.duration_days ? `${item.duration_days} Gün` : 'Kalıcı'}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.gridPreviewArea}
                        onPress={() => setPreviewItem(item)}
                        activeOpacity={0.8}
                    >
                        {item.category === 'avatar_frame' ? (
                            <VipFrame
                                level={item.key.includes('dealer') ? 'dealer' : parseInt(item.key.replace(/\D/g, '')) || 1}
                                avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150"
                                size={60}
                                isStatic={true}
                            />
                        ) : (
                            <Image
                                source={require('../assets/gift_icon.webp')}
                                style={styles.gridPreviewImg}
                                resizeMode="contain"
                            />
                        )}
                    </TouchableOpacity>

                    <Text style={styles.gridItemName} numberOfLines={1}>{item.name}</Text>

                    <View style={styles.gridPrice}>
                        <FontAwesome5 name="coins" size={10} color="#F6C453" style={{ marginRight: 4 }} />
                        <Text style={styles.gridPriceText}>{item.price.toLocaleString('tr-TR')}</Text>
                    </View>

                    <View style={styles.gridActions}>
                        {isOwned ? (
                            <TouchableOpacity
                                style={styles.ownedBtn}
                                onPress={() => navigation.navigate('Bag')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.ownedBtnText}>Çantada</Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={styles.gridPreviewBtn}
                                    onPress={() => setPreviewItem(item)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.gridPreviewBtnText}>Önizle</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.gridBuyBtn}
                                    onPress={() => setPurchaseItem(item)}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={['#FF4FA3', '#8B5CFF']}
                                        style={styles.gridBuyGradient}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    >
                                        <Text style={styles.gridBuyText}>Al</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </LinearGradient>
            </View>
        );
    }, [ownedItemsKeys, navigation]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={['#29101A', '#0F080A']}
                style={StyleSheet.absoluteFill}
            />

            <SafeAreaView style={styles.safeArea}>
                {/* Store Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circleBtn}>
                        <Ionicons name="chevron-back" size={24} color="#ffffff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Mağaza</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Bag')} style={styles.circleBtn}>
                        <Ionicons name="briefcase-outline" size={22} color="#FF4FA3" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                    {/* Premium Golden Glass Wallet Balance Card */}
                    <View style={styles.balanceWrapper}>
                        <LinearGradient
                            colors={['rgba(246, 196, 83, 0.15)', 'rgba(255, 255, 255, 0.02)']}
                            style={styles.balanceCard}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={styles.balanceLeft}>
                                <Animated.View style={{ transform: [{ translateY: floatAnim }], marginRight: 12 }}>
                                    <LinearGradient
                                        colors={['#F6C453', '#F29C38']}
                                        style={styles.coinIconCircle}
                                    >
                                        <FontAwesome5 name="coins" size={16} color="#ffffff" />
                                    </LinearGradient>
                                </Animated.View>
                                <View>
                                    <Text style={styles.balanceLabel}>ALTIN CÜZDANIM</Text>
                                    <Text style={styles.balanceValue}>{balance.toLocaleString('tr-TR')}</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.rechargeBtn}
                                onPress={() => navigation.navigate('Shop')}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={['#F6C453', '#F29C38']}
                                    style={styles.rechargeGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Text style={styles.rechargeBtnText}>YÜKLE</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </LinearGradient>
                    </View>

                    {/* Coin & Premium Offers */}
                    <View style={styles.storeOffers}>

                        {/* ✨ Animated Premium Banner */}
                        <Animated.View style={[styles.premiumBannerWrap, { transform: [{ scale: bannerScale }] }]}>
                            <LinearGradient
                                colors={['#6B0F2B', '#BE1A3D', '#FF4165', '#BE1A3D', '#6B0F2B']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.premiumBannerGradient}
                            >
                                {/* Shimmer overlay */}
                                <Animated.View
                                    style={[
                                        styles.premiumBannerShimmer,
                                        {
                                            transform: [{
                                                translateX: bannerShimmer.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [-width, width],
                                                })
                                            }]
                                        }
                                    ]}
                                    pointerEvents="none"
                                />

                                {/* Glow top circle */}
                                <Animated.View
                                    style={[styles.premiumBannerGlowCircle, {
                                        opacity: bannerGlow.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0.18, 0.42]
                                        })
                                    }]}
                                    pointerEvents="none"
                                />

                                {/* Left icon cluster */}
                                <View style={styles.premiumBannerLeft}>
                                    <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
                                        <View style={styles.premiumBannerIconCircle}>
                                            <LinearGradient
                                                colors={['#FF6B8A', '#E8254A', '#9B1030']}
                                                style={styles.premiumBannerIconGrad}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                            >
                                                <Ionicons name="diamond" size={26} color="#fff" />
                                            </LinearGradient>
                                        </View>
                                    </Animated.View>
                                </View>

                                {/* Center text */}
                                <View style={styles.premiumBannerCenter}>
                                    <View style={styles.premiumBannerBadge}>
                                        <Ionicons name="sparkles" size={9} color="#FFE88A" style={{ marginRight: 4 }} />
                                        <Text style={styles.premiumBannerBadgeText}>ÖZEL TEKLİF</Text>
                                    </View>
                                    <Text style={styles.premiumBannerTitle}>Premium Üyelik</Text>
                                    <Text style={styles.premiumBannerSubtitle}>
                                        Eşsiz özelliklerle aşkı{'\n'}daha yakın hisset
                                    </Text>
                                </View>

                                {/* Right side — subtle icon stack */}
                                <View style={styles.premiumBannerRight}>
                                    <Animated.View style={{ transform: [{ translateY: bannerGlow.interpolate({ inputRange: [0,1], outputRange: [0, -4] }) }] }}>
                                        <View style={styles.premiumBannerRightIcon}>
                                            <Ionicons name="heart" size={32} color="rgba(255,255,255,0.18)" />
                                        </View>
                                    </Animated.View>
                                    <View style={styles.premiumBannerRightIconSmall}>
                                        <Ionicons name="heart" size={16} color="rgba(255,255,255,0.10)" />
                                    </View>
                                </View>
                            </LinearGradient>
                        </Animated.View>

                        <Text style={styles.premiumSectionTitle}>PREMIUM ÜYELİK</Text>
                        <Text style={styles.premiumSectionSubtitle}>Sana en uygun süreyi seç</Text>

                        {/* Joined 3-Card Segmented Container */}
                        <View style={styles.segmentedPlansWrapper}>
                            {PREMIUM_PLANS.map((plan, index) => {
                                const isPopular = index === 1;
                                const isBest = index === 2;
                                return (
                                    <TouchableOpacity
                                        key={plan.months}
                                        style={[
                                            styles.segmentedPlanCard,
                                            isPopular && styles.segmentedPlanCardPopular,
                                            isBest && styles.segmentedPlanCardBest,
                                        ]}
                                        onPress={() => handlePremiumPurchase(plan)}
                                        activeOpacity={0.88}
                                    >
                                        <LinearGradient
                                            colors={
                                                isPopular
                                                    ? ['#8A1538', '#3D0918']
                                                    : isBest
                                                    ? ['#5C1027', '#290610']
                                                    : ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']
                                            }
                                            style={StyleSheet.absoluteFill}
                                        />

                                        {/* Top Badge */}
                                        <View style={[
                                            styles.segmentedBadge,
                                            isPopular && styles.segmentedBadgePopular,
                                            isBest && styles.segmentedBadgeBest
                                        ]}>
                                            <Text style={[
                                                styles.segmentedBadgeText,
                                                isPopular && styles.segmentedBadgeTextPopular,
                                                isBest && styles.segmentedBadgeTextBest
                                            ]}>{plan.badge}</Text>
                                        </View>

                                        {/* Icon */}
                                        <View style={[styles.segmentedIconCircle, isPopular && styles.segmentedIconCirclePopular]}>
                                            <Ionicons name="diamond" size={18} color={isPopular ? "#FFD700" : isBest ? "#FF4FA3" : "#F6C453"} />
                                        </View>

                                        {/* Title */}
                                        <Text style={styles.segmentedPlanTitle}>{plan.label}</Text>
                                        <Text style={styles.segmentedPlanSub}>Premium</Text>

                                        {/* Price */}
                                        <Text style={[styles.segmentedPlanPrice, isPopular && { color: '#FFD700' }]}>{plan.price}</Text>

                                        {/* Monthly Price Breakdown */}
                                        <Text style={styles.segmentedMonthlyPrice}>
                                            {plan.months === 1 ? '449,99 ₺/ay' : plan.months === 3 ? '323 ₺/ay' : '250 ₺/ay'}
                                        </Text>

                                        {/* Purchase Button */}
                                        <View style={[styles.segmentedBuyBtn, isPopular && styles.segmentedBuyBtnPopular]}>
                                            <LinearGradient
                                                colors={isPopular ? ['#FFD700', '#F29C38'] : ['#FF4FA3', '#8B5CFF']}
                                                style={styles.segmentedBuyGradient}
                                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                            >
                                                <Text style={[styles.segmentedBuyText, isPopular && { color: '#1A0008' }]}>SEÇ</Text>
                                            </LinearGradient>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Premium Benefits Glass Card */}
                        <View style={styles.benefitsCard}>
                            <LinearGradient
                                colors={['rgba(255, 79, 163, 0.08)', 'rgba(139, 92, 255, 0.03)']}
                                style={styles.benefitsCardGradient}
                            >
                                <View style={styles.benefitsHeader}>
                                    <Ionicons name="sparkles" size={16} color="#FFB020" style={{ marginRight: 6 }} />
                                    <Text style={styles.benefitsTitle}>Tüm Premium Ayrıcalıkları</Text>
                                </View>
                                <View style={styles.benefitsGrid}>
                                    {[
                                        { icon: 'call', text: 'Sesli ve görüntülü arama' },
                                        { icon: 'location', text: 'Konum gönderme ve alma' },
                                        { icon: 'heart', text: 'Sınırsız beğeni hakkı' },
                                        { icon: 'megaphone', text: 'Keşfette paylaşım hakkı' },
                                        { icon: 'trending-up', text: 'Keşfette daha üstte görün' },
                                    ].map((b, i) => (
                                        <View key={i} style={styles.benefitRow}>
                                            <View style={styles.benefitIconWrap}>
                                                <Ionicons name={b.icon} size={13} color="#FF4FA3" />
                                            </View>
                                            <Text style={styles.benefitRowText}>{b.text}</Text>
                                        </View>
                                    ))}
                                </View>
                            </LinearGradient>
                        </View>
                    </View>
                </ScrollView>

                {false && (<>
                    {/* Fixed Grid Category Tabs (No Scroll) */}
                    <View style={styles.tabsContainer}>
                        <View style={styles.tabsGrid}>
                            {CATEGORIES.map(category => {
                                const isActive = activeTab === category.id;
                                return (
                                    <TouchableOpacity
                                        key={category.id}
                                        style={styles.tabItem}
                                        onPress={() => setActiveTab(category.id)}
                                        activeOpacity={0.8}
                                    >
                                        {isActive ? (
                                            <View style={styles.tabInnerActive}>
                                                <MaskedView
                                                    style={{ width: 15, height: 15, marginRight: 5 }}
                                                    maskElement={
                                                        <Ionicons name={category.icon} size={14} color="black" />
                                                    }
                                                >
                                                    <LinearGradient
                                                        colors={['#FF4FA3', '#8B5CFF']}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 0 }}
                                                        style={{ flex: 1 }}
                                                    />
                                                </MaskedView>
                                                <GradientText
                                                    colors={['#FF4FA3', '#8B5CFF']}
                                                    style={styles.activeTabLabel}
                                                >
                                                    {category.label}
                                                </GradientText>
                                            </View>
                                        ) : (
                                            <View style={styles.tabInner}>
                                                <Ionicons name={category.icon} size={13} color="rgba(255,255,255,0.4)" style={{ marginRight: 4 }} />
                                                <Text style={styles.tabLabel}>{category.label}</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Main Scroll Content */}
                    {loading ? (
                        <View style={styles.gridLoader}>
                            <ActivityIndicator size="large" color="#FF4FA3" />
                        </View>
                    ) : (
                        <FlatList
                            data={catalogItems}
                            renderItem={renderCatalogItem}
                            keyExtractor={item => item.id?.toString() || Math.random().toString()}
                            numColumns={2}
                            columnWrapperStyle={styles.columnWrapper}
                            contentContainerStyle={styles.mainScroll}
                            showsVerticalScrollIndicator={false}
                            initialNumToRender={6}
                            maxToRenderPerBatch={10}
                            windowSize={5}
                            removeClippedSubviews={true}
                            ListHeaderComponent={
                                <>
                                    {/* Featured Item Banner */}
                                    {featuredItem && (
                                        <Motion.SlideUp delay={100} style={styles.featuredWrapper}>
                                            <LinearGradient
                                                colors={['rgba(139, 92, 255, 0.18)', 'rgba(255, 79, 163, 0.04)']}
                                                style={styles.featuredBanner}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                            >
                                                <View style={styles.featuredLeft}>
                                                    <View style={[styles.featRarity, { backgroundColor: getRarityColor(featuredItem.rarity) }]}>
                                                        <Text style={styles.featRarityText}>{featuredItem.rarity?.toUpperCase()}</Text>
                                                    </View>
                                                    <Text style={styles.featSubtitle}>ÖNE ÇIKAN SEÇKİN ÜRÜN</Text>
                                                    <Text style={styles.featTitle}>{featuredItem.name}</Text>
                                                    <View style={styles.featPriceRow}>
                                                        <FontAwesome5 name="coins" size={12} color="#F6C453" style={{ marginRight: 5 }} />
                                                        <Text style={styles.featPriceVal}>{featuredItem.price.toLocaleString('tr-TR')} Altın</Text>
                                                    </View>

                                                    <View style={styles.featActions}>
                                                        <TouchableOpacity
                                                            style={styles.featPreviewBtn}
                                                            onPress={() => setPreviewItem(featuredItem)}
                                                            activeOpacity={0.8}
                                                        >
                                                            <Text style={styles.featPrevBtnText}>Önizle</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={styles.featBuyBtn}
                                                            onPress={() => setPurchaseItem(featuredItem)}
                                                            activeOpacity={0.8}
                                                        >
                                                            <LinearGradient
                                                                colors={['#FF4FA3', '#8B5CFF']}
                                                                style={styles.featBuyGradient}
                                                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                                            >
                                                                <Text style={styles.featBuyBtnText}>Satın Al</Text>
                                                            </LinearGradient>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                                <View style={styles.featuredRight}>
                                                    <View style={styles.featuredShowcaseOuter}>
                                                        {featuredItem.category === 'avatar_frame' ? (
                                                            <VipFrame
                                                                level={featuredItem.key.includes('dealer') ? 'dealer' : parseInt(featuredItem.key.replace(/\D/g, '')) || 1}
                                                                avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150"
                                                                size={80}
                                                                isStatic={true}
                                                            />
                                                        ) : (
                                                            <Image
                                                                source={require('../assets/gift_icon.webp')}
                                                                style={styles.featuredGlowImg}
                                                                resizeMode="contain"
                                                            />
                                                        )}
                                                    </View>
                                                </View>
                                            </LinearGradient>
                                        </Motion.SlideUp>
                                    )}
                                    <Text style={styles.gridSectionTitle}>Market Kataloğu</Text>
                                </>
                            }
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <View style={styles.emptyIconCircle}>
                                        <Ionicons name="cart-outline" size={40} color="rgba(255, 255, 255, 0.15)" />
                                    </View>
                                    <Text style={styles.emptyTitle}>Kategori Boş</Text>
                                    <Text style={styles.emptyDesc}>Bu kategoride henüz satılık ürün bulunmuyor. Yakında yeni premium ürünler eklenecektir!</Text>
                                </View>
                            }
                        />
                    )}
                </>)}

                {/* MODAL 1: ProductPreviewModal */}
                <Modal
                    visible={!!previewItem}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setPreviewItem(null)}
                >
                    <View style={styles.modalOverlay}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPreviewItem(null)} />

                        <LinearGradient
                            colors={['#0F1535', '#080B1E']}
                            style={styles.previewModalCard}
                            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                        >
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPreviewItem(null)}>
                                <Ionicons name="close" size={22} color="#ffffff" />
                            </TouchableOpacity>

                            <View style={styles.previewHeaderRow}>
                                <Text style={styles.previewCategory}>
                                    {CATEGORIES.find(c => c.id === previewItem?.category)?.label.toUpperCase()}
                                </Text>
                                <View style={[styles.previewRarity, { backgroundColor: getRarityColor(previewItem?.rarity) }]}>
                                    <Text style={styles.previewRarityText}>{previewItem?.rarity.toUpperCase()}</Text>
                                </View>
                            </View>

                            <Text style={styles.previewTitle}>{previewItem?.name}</Text>
                            <Text style={styles.previewDesc}>{previewItem?.description}</Text>

                            <View style={styles.showcaseWrapper}>
                                {previewItem?.category === 'avatar_frame' && (
                                    <View style={styles.frameShowcase}>
                                        <VipFrame
                                            level={previewItem.key.includes('dealer') ? 'dealer' : parseInt(previewItem.key.replace(/\D/g, '')) || 1}
                                            avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200"
                                            size={95}
                                            isStatic={true}
                                        />
                                    </View>
                                )}
                            </View>

                            <View style={styles.previewFooter}>
                                <View style={styles.previewSpecs}>
                                    <View style={styles.specBox}>
                                        <Text style={styles.specLabel}>SÜRE</Text>
                                        <Text style={styles.specVal}>
                                            {previewItem?.duration_days ? `${previewItem?.duration_days} Gün` : 'Kalıcı'}
                                        </Text>
                                    </View>
                                    <View style={styles.specDivider} />
                                    <View style={styles.specBox}>
                                        <Text style={styles.specLabel}>FİYAT</Text>
                                        <Text style={styles.specVal}>
                                            <FontAwesome5 name="coins" size={11} color="#F6C453" /> {previewItem?.price.toLocaleString('tr-TR')}
                                        </Text>
                                    </View>
                                </View>

                                {ownedItemsKeys.has(previewItem?.key) ? (
                                    <TouchableOpacity style={styles.previewOwnedBtn} onPress={() => { setPreviewItem(null); navigation.navigate('Bag'); }}>
                                        <Text style={styles.previewOwnedBtnText}>Zaten Sahipsin (Çantaya Git)</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity style={styles.previewBuyBtn} onPress={() => setPurchaseItem(previewItem)}>
                                        <LinearGradient colors={['#FF4FA3', '#8B5CFF']} style={styles.previewBuyGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                            <Text style={styles.previewBuyText}>Satın Al</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </LinearGradient>
                    </View>
                </Modal>

                {/* MODAL 2: PurchaseConfirmModal */}
                <Modal
                    visible={!!purchaseItem}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setPurchaseItem(null)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.purchaseConfirmCard}>
                            <Text style={styles.confirmHeader}>Satın Almayı Onayla</Text>
                            <View style={styles.confirmDetailRow}>
                                <Text style={styles.confirmItemName}>{purchaseItem?.name}</Text>
                                <Text style={styles.confirmItemDuration}>{purchaseItem?.duration_days ? `${purchaseItem?.duration_days} Günlük Lisans` : 'Kalıcı Lisans'}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.priceSummary}>
                                <View style={styles.priceSummaryRow}>
                                    <Text style={styles.priceSummaryLabel}>Ürün Fiyatı</Text>
                                    <Text style={styles.priceSummaryValue}>
                                        <FontAwesome5 name="coins" size={12} color="#F6C453" /> {purchaseItem?.price.toLocaleString('tr-TR')} Altın
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.confirmActions}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setPurchaseItem(null)} disabled={purchasing}>
                                    <Text style={styles.cancelBtnText}>Vazgeç</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.confirmBuyBtn} onPress={handlePurchase} disabled={purchasing}>
                                    <LinearGradient colors={['#FF4FA3', '#8B5CFF']} style={styles.confirmBuyGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                        {purchasing ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.confirmBuyText}>Onayla</Text>}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

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
    container: {
        flex: 1,
        backgroundColor: '#070B1F',
    },
    glowSpot: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        opacity: 0.15,
        zIndex: 0,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        height: 70,
        marginTop: Platform.OS === 'ios' ? 0 : 25,
        zIndex: 10,
    },
    circleBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    balanceWrapper: {
        paddingHorizontal: 20,
        marginTop: 10,
        marginBottom: 14,
        zIndex: 10,
    },
    balanceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(246, 196, 83, 0.18)',
    },
    balanceLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    coinIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#F6C453',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
        elevation: 3,
    },
    balanceLabel: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 2,
    },
    balanceValue: {
        color: '#F6C453',
        fontSize: 22,
        fontWeight: '900',
    },
    rechargeBtn: {
        width: 82,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
    },
    rechargeGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rechargeBtnText: {
        color: '#ffffff',
        fontSize: 11.5,
        fontWeight: '900',
    },
    storeOffers: {
        paddingHorizontal: 20,
        marginBottom: 14,
    },
    // ===== PREMIUM BANNER STYLES =====
    premiumBannerWrap: {
        marginBottom: 16,
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#FF4165',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
        elevation: 10,
    },
    premiumBannerGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 18,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 120, 140, 0.35)',
        minHeight: 110,
    },
    premiumBannerShimmer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 40,
        height: '100%',
        backgroundColor: 'rgba(255,255,255,0.07)',
        transform: [{ skewX: '-15deg' }],
    },
    premiumBannerGlowCircle: {
        position: 'absolute',
        top: -60,
        right: -20,
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor: 'rgba(255,100,130,0.15)',
    },
    premiumBannerLeft: {
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    premiumBannerIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: '#E8254A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 6,
    },
    premiumBannerIconGrad: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    premiumBannerCenter: {
        flex: 1,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    premiumBannerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.14)',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginBottom: 7,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    premiumBannerBadgeText: {
        color: '#FFE88A',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.2,
    },
    premiumBannerTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 0.2,
        marginBottom: 5,
        textShadowColor: 'rgba(0,0,0,0.25)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    premiumBannerSubtitle: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 11.5,
        lineHeight: 17,
        fontWeight: '400',
    },
    premiumBannerRight: {
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
        position: 'relative',
    },
    premiumBannerRightIcon: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    premiumBannerRightIconSmall: {
        position: 'absolute',
        top: -12,
        right: -6,
    },
    premiumPlansRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        gap: 8,
        marginTop: 10,
        height: 450,
    },
    planAnimated: {
        flex: 0,
        width: (width - 56) / 3,
        height: 450,
    },
    premiumSectionTitle: {
        color: '#FFB020',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.6,
        marginBottom: -4,
    },
    premiumSectionSubtitle: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
        marginBottom: 2,
    },
    premiumOffer: {
        height: 450,
        flex: 0,
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        paddingHorizontal: 8,
        paddingVertical: 16,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(232, 62, 80, 0.38)',
    },
    premiumOfferPopular: {
        borderColor: 'rgba(255, 176, 32, 0.52)',
    },
    premiumOfferBest: {
        borderColor: 'rgba(255, 77, 90, 0.68)',
        shadowColor: '#E83E50',
        shadowOpacity: 0.28,
        shadowRadius: 12,
        elevation: 6,
    },
    coinOffer: {
        minHeight: 78,
        borderRadius: 22,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#281017',
        borderWidth: 1,
        borderColor: 'rgba(255, 176, 32, 0.24)',
    },
    offerIcon: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 176, 32, 0.14)',
        marginRight: 0,
        marginBottom: 8,
    },
    offerTextWrap: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
    },
    planTitleRow: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        height: 82,
        gap: 4,
    },
    planBadge: {
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 176, 32, 0.18)',
    },
    planBadgeBest: {
        backgroundColor: 'rgba(232, 62, 80, 0.28)',
    },
    planBadgeText: {
        color: '#FFB020',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.4,
    },
    offerEyebrow: {
        color: '#FFB020',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.2,
    },
    offerTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        marginTop: 0,
        textAlign: 'center',
    },
    offerSubtitle: {
        color: 'rgba(255,255,255,0.58)',
        fontSize: 11,
        marginTop: 6,
        textAlign: 'center',
        minHeight: 30,
    },
    planPrice: {
        color: '#FFB020',
        fontSize: 17,
        fontWeight: '900',
        marginTop: 14,
        textAlign: 'center',
        height: 24,
    },
    planBenefits: {
        width: '100%',
        marginTop: 16,
        gap: 8,
    },
    planBenefitRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 4,
    },
    planBenefitText: {
        flex: 1,
        color: 'rgba(255,255,255,0.72)',
        fontSize: 9,
        lineHeight: 13,
        marginLeft: 4,
    },
    tabsContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
        zIndex: 10,
    },
    tabsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 6,
    },
    tabItem: {
        borderRadius: 18,
        overflow: 'hidden',
    },
    tabInnerActive: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        backgroundColor: 'transparent',
    },
    tabInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        backgroundColor: 'transparent',
    },
    tabLabel: {
        fontSize: 11.5,
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.45)',
    },
    activeTabLabel: {
        fontSize: 11.5,
        fontWeight: '800',
    },
    mainScroll: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    featuredWrapper: {
        marginBottom: 20,
    },
    featuredBanner: {
        borderRadius: 26,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 255, 0.25)',
        position: 'relative',
        overflow: 'hidden',
    },
    featuredLeft: {
        flex: 1.2,
        paddingRight: 10,
    },
    featRarity: {
        alignSelf: 'flex-start',
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 7,
        marginBottom: 8,
    },
    featRarityText: {
        color: '#ffffff',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    featSubtitle: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    featTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 6,
    },
    featPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    featPriceVal: {
        color: '#F6C453',
        fontSize: 14,
        fontWeight: '900',
    },
    featActions: {
        flexDirection: 'row',
        gap: 8,
    },
    featPreviewBtn: {
        flex: 1,
        height: 36,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    featPrevBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
    },
    featBuyBtn: {
        flex: 1.3,
        height: 36,
        borderRadius: 12,
        overflow: 'hidden',
    },
    featBuyGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    featBuyBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
    },
    featuredRight: {
        flex: 0.8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    featuredShowcaseOuter: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    featuredGlowImg: {
        width: 75,
        height: 75,
    },
    gridSectionTitle: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '900',
        marginBottom: 14,
        letterSpacing: 0.5,
    },
    gridLoader: {
        paddingVertical: 50,
        alignItems: 'center',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 12,
    },
    gridCardWrapper: {
        width: (width - 52) / 2,
    },
    gridCard: {
        borderRadius: 24,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    gridCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 10,
    },
    gridRarity: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    gridRarityText: {
        color: '#ffffff',
        fontSize: 7.5,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    gridDuration: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 9,
        fontWeight: '800',
    },
    gridPreviewArea: {
        height: 75,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 6,
    },
    gridPreviewImg: {
        width: 60,
        height: 60,
    },
    gridItemName: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '800',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 3,
        width: '100%',
    },
    gridPrice: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    gridPriceText: {
        color: '#F6C453',
        fontSize: 12,
        fontWeight: '900',
    },
    gridActions: {
        flexDirection: 'row',
        width: '100%',
        gap: 6,
    },
    gridPreviewBtn: {
        flex: 1,
        height: 32,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    gridPreviewBtnText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '700',
    },
    gridBuyBtn: {
        flex: 1.2,
        height: 32,
        borderRadius: 10,
        overflow: 'hidden',
    },
    gridBuyGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    gridBuyText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '800',
    },
    ownedBtn: {
        width: '100%',
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    ownedBtnText: {
        color: '#FF4FA3',
        fontSize: 11,
        fontWeight: '900',
    },
    emptyContainer: {
        paddingVertical: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyIconCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '800',
        marginBottom: 6,
    },
    emptyDesc: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 11.5,
        lineHeight: 18,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewModalCard: {
        width: width - 40,
        borderRadius: 32,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        position: 'relative',
    },
    modalCloseBtn: {
        position: 'absolute',
        top: 20,
        right: 20,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        gap: 8,
    },
    previewCategory: {
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    previewRarity: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    previewRarityText: {
        color: '#ffffff',
        fontSize: 7.5,
        fontWeight: '900',
    },
    previewTitle: {
        color: '#ffffff',
        fontSize: 22,
        fontWeight: '900',
        marginBottom: 8,
        textAlign: 'center',
    },
    previewDesc: {
        color: 'rgba(255, 255, 255, 0.55)',
        fontSize: 12.5,
        lineHeight: 19,
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 12,
    },
    showcaseWrapper: {
        width: '100%',
        height: 140,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 22,
    },
    frameShowcase: {
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewFooter: {
        width: '100%',
    },
    previewSpecs: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 22,
        gap: 30,
    },
    specBox: {
        alignItems: 'center',
    },
    specLabel: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 9,
        fontWeight: 'bold',
        marginBottom: 3,
    },
    specVal: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    specDivider: {
        width: 1,
        height: 25,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    previewBuyBtn: {
        width: '100%',
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
    },
    previewBuyGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewBuyText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    previewOwnedBtn: {
        width: '100%',
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewOwnedBtnText: {
        color: '#FF4FA3',
        fontSize: 13.5,
        fontWeight: 'bold',
    },
    purchaseConfirmCard: {
        width: width - 40,
        borderRadius: 28,
        padding: 24,
        backgroundColor: '#0F1535',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    confirmHeader: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    confirmDetailRow: {
        alignItems: 'center',
        marginBottom: 16,
    },
    confirmItemName: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    confirmItemDuration: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginVertical: 14,
    },
    priceSummary: {
        width: '100%',
    },
    priceSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    priceSummaryLabel: {
        color: 'rgba(255, 255, 255, 0.65)',
        fontSize: 12,
    },
    priceSummaryValue: {
        color: '#ffffff',
        fontSize: 12.5,
        fontWeight: 'bold',
    },
    confirmActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
    },
    cancelBtn: {
        flex: 1,
        height: 46,
        borderRadius: 23,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelBtnText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 13,
        fontWeight: 'bold',
    },
    confirmBuyBtn: {
        flex: 1.3,
        height: 46,
        borderRadius: 23,
        overflow: 'hidden',
    },
    confirmBuyGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmBuyText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 'bold',
    },

    // Maintenance Mode Styles
    maintContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    maintCardWrapper: {
        width: '100%',
        alignItems: 'center',
    },
    maintCard: {
        width: '100%',
        borderRadius: 28,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 79, 163, 0.25)',
        backgroundColor: 'rgba(20, 14, 48, 0.6)',
    },
    maintIconOuter: {
        width: 84,
        height: 84,
        borderRadius: 42,
        padding: 3,
        backgroundColor: 'rgba(255, 79, 163, 0.2)',
        marginBottom: 16,
    },
    maintIconGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF4FA3',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 6,
    },
    maintTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 79, 163, 0.12)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 79, 163, 0.25)',
        marginBottom: 14,
    },
    maintTagText: {
        color: '#FF4FA3',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    maintTitle: {
        fontSize: 24,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 10,
    },
    maintDesc: {
        color: 'rgba(255, 255, 255, 0.65)',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 20,
        paddingHorizontal: 8,
    },
    maintFeatureBox: {
        width: '100%',
        borderRadius: 18,
        overflow: 'hidden',
        marginBottom: 24,
    },
    maintFeatureGradient: {
        padding: 16,
        alignItems: 'center',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(246, 196, 83, 0.25)',
    },
    maintFeatureTitle: {
        color: '#F6C453',
        fontSize: 14,
        fontWeight: '900',
        marginBottom: 4,
    },
    maintFeatureText: {
        color: 'rgba(255, 255, 255, 0.75)',
        fontSize: 11.5,
        textAlign: 'center',
        lineHeight: 17,
        fontWeight: '600',
    },
    maintActions: {
        width: '100%',
        alignItems: 'center',
        gap: 10,
    },
    maintPrimaryBtn: {
        width: '100%',
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
    },
    maintBtnGradient: {
        width: '100%',
        height: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    maintBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '900',
    },
    maintSecondaryBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    maintSecondaryText: {
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: 12.5,
        fontWeight: '700',
    },
});
