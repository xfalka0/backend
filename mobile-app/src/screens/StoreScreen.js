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

const IS_MAINTENANCE_MODE = true;

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

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, { toValue: -6, duration: 1500, useNativeDriver: true }),
                Animated.timing(floatAnim, { toValue: 0, duration: 1500, useNativeDriver: true })
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
                        <Text style={styles.headerTitle}>Premium Mağaza</Text>
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
                colors={['#312361', '#140E30']}
                style={StyleSheet.absoluteFill}
            />

            <SafeAreaView style={styles.safeArea}>
                {/* Store Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circleBtn}>
                        <Ionicons name="chevron-back" size={24} color="#ffffff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Premium Mağaza</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Bag')} style={styles.circleBtn}>
                        <Ionicons name="briefcase-outline" size={22} color="#FF4FA3" />
                    </TouchableOpacity>
                </View>

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
