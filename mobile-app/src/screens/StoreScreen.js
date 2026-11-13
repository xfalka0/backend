import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, StatusBar, TouchableOpacity, Text, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';
import { PurchaseService } from '../services/purchaseService';
import ModernAlert from '../components/ui/ModernAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Theme & Store Subcomponents
import { LAYOUT } from '../theme';
import { STORE_THEME } from '../constants/storeTheme';
import StoreHeader from '../components/store/StoreHeader';
import PremiumHero from '../components/store/PremiumHero';
import FeatureGrid from '../components/store/FeatureGrid';
import PlanList from '../components/store/PlanList';
import StickyPurchaseBar from '../components/store/StickyPurchaseBar';
import PremiumSuccessModal from '../components/store/PremiumSuccessModal';
import ActiveSubscriptionBanner from '../components/store/ActiveSubscriptionBanner';
import { useAppStore } from '../store/useAppStore';

const PREMIUM_PLANS = [
    { months: 1, badge: 'BAŞLANGIÇ', price: '449,99 ₺', productId: 'premium_1_month' },
    { months: 3, badge: 'POPÜLER', price: '969,99 ₺', productId: 'premium_3_months' },
    { months: 6, badge: 'EN AVANTAJLI', price: '1499,99 ₺', productId: 'premium_6_months' },
];

const WEEKLY_SOCIAL_PROOF = '2.340';

export default function StoreScreen({ navigation, route }) {
    const { user: initialUser } = route.params || {};
    const insets = useSafeAreaInsets();
    const tabOffset = LAYOUT.tabBarHeight + LAYOUT.tabBarBottomOffset;

    const [currentUser, setCurrentUser] = useState(initialUser || null);
    const [balance, setBalance] = useState(initialUser?.balance || 0);
    const [purchasing, setPurchasing] = useState(false);
    
    const defaultIndex = Math.max(0, PREMIUM_PLANS.findIndex(p => p.badge === 'POPÜLER'));
    const [selectedPlanIndex, setSelectedPlanIndex] = useState(defaultIndex);
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info' });
    const [premiumSuccessVisible, setPremiumSuccessVisible] = useState(false);

    // Premium is the timed subscription that expires. VIP is permanent level progression.
    const premiumExpireDate = currentUser?.premium_expire_date || currentUser?.vip_expire_date;
    const hasActiveExpire = Boolean(
        premiumExpireDate && new Date(premiumExpireDate) > new Date()
    );
    const isPremium = Boolean(
        hasActiveExpire || 
        (currentUser?.is_premium && (!premiumExpireDate || hasActiveExpire))
    );

    // Fetch user profile and balance
    const fetchUserData = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const storedUserStr = await AsyncStorage.getItem('user');
            let parsedUser = null;
            if (storedUserStr) {
                parsedUser = JSON.parse(storedUserStr);
                setCurrentUser(parsedUser);
                if (parsedUser.balance !== undefined) setBalance(Number(parsedUser.balance));
            }

            const targetId = parsedUser?.id || initialUser?.id;
            if (targetId && token) {
                const res = await axios.get(`${API_URL}/users/${targetId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data) {
                    const freshUser = res.data;
                    setCurrentUser(freshUser);
                    if (freshUser.balance !== undefined) {
                        setBalance(Number(freshUser.balance));
                    }
                    await AsyncStorage.setItem('user', JSON.stringify(freshUser));
                }
            } else if (token) {
                const balRes = await axios.get(`${API_URL}/users/balance`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (balRes.data && balRes.data.balance !== undefined) {
                    setBalance(Number(balRes.data.balance));
                }
            }

            // Sync active subscription from RevenueCat / Google Play if user already subscribed
            try {
                const info = await PurchaseService.getCustomerInfo();
                await syncSubscriptionFromCustomerInfo(info);
            } catch (rcErr) {
                console.log('[STORE] RevenueCat customer info error:', rcErr.message);
            }
        } catch (err) {
            console.log('[STORE] User fetch error:', err.message);
        }
    };

    const syncSubscriptionFromCustomerInfo = async (customerInfo) => {
        if (!customerInfo) return false;

        const activeSubs = customerInfo.activeSubscriptions || [];
        const activeEntitlements = customerInfo.entitlements?.active || {};

        const hasActive = activeSubs.length > 0 || Object.keys(activeEntitlements).length > 0;
        if (!hasActive) return false;

        const subId = activeSubs[0] || Object.keys(activeEntitlements)[0];
        let months = 1;
        if (subId?.includes('3_month') || subId?.includes('3_ay')) months = 3;
        else if (subId?.includes('6_month') || subId?.includes('6_ay')) months = 6;
        else if (subId?.includes('12_month') || subId?.includes('1_year')) months = 12;

        let expireDate = customerInfo.allExpirationDates?.[subId] || 
                         activeEntitlements[subId]?.expirationDate;
        if (!expireDate) {
            const d = new Date();
            d.setMonth(d.getMonth() + months);
            expireDate = d.toISOString();
        }

        const token = await AsyncStorage.getItem('token');
        if (token) {
            try {
                await axios.post(`${API_URL}/vip/upgrade-direct`, {
                    months: months,
                    transactionId: customerInfo.originalAppUserId || `rc_sync_${Date.now()}`
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } catch (e) {
                console.log('[STORE] Subscription sync error:', e.message);
            }
        }

        const storeUser = useAppStore.getState().user;
        const updatedUser = {
            ...(storeUser || currentUser || {}),
            is_premium: true,
            premium_expire_date: expireDate,
            premium_start_date: storeUser?.premium_start_date || new Date().toISOString(),
            vip_expire_date: expireDate,
            vip_start_date: storeUser?.vip_start_date || new Date().toISOString()
        };
        useAppStore.getState().setUser(updatedUser);
        setCurrentUser(updatedUser);
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        return true;
    };

    useFocusEffect(
        useCallback(() => {
            fetchUserData();
        }, [])
    );

    // Handle purchasing selected plan
    const handlePurchaseCurrentPlan = async () => {
        const plan = PREMIUM_PLANS[selectedPlanIndex];
        if (!plan) return;

        try {
            setPurchasing(true);
            const result = await PurchaseService.purchaseProductByIdentifier(
                plan.productId,
                'SUBS'
            );
            if (result.success) {
                const token = await AsyncStorage.getItem('token');
                let newExpireDate = null;
                try {
                    const syncRes = await axios.post(`${API_URL}/vip/upgrade-direct`, {
                        months: plan.months,
                        transactionId: result.customerInfo?.originalAppUserId || `rc_${Date.now()}`
                    }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (syncRes.data?.vip_expire_date) {
                        newExpireDate = syncRes.data.vip_expire_date;
                    }
                } catch (err) {
                    console.log('Backend sync error:', err.message);
                }

                if (!newExpireDate) {
                    const d = new Date();
                    d.setMonth(d.getMonth() + plan.months);
                    newExpireDate = d.toISOString();
                }

                const storeUser = useAppStore.getState().user;
                const updatedUser = {
                    ...(storeUser || currentUser || {}),
                    is_premium: true,
                    premium_expire_date: newExpireDate,
                    premium_start_date: storeUser?.premium_start_date || new Date().toISOString(),
                    vip_expire_date: newExpireDate,
                    vip_start_date: storeUser?.vip_start_date || new Date().toISOString()
                };
                useAppStore.getState().setUser(updatedUser);
                setCurrentUser(updatedUser);
                await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

                setPremiumSuccessVisible(true);
            } else if (!result.cancelled) {
                console.warn('[STORE] Premium purchase failed:', result.error);
                const isAlreadyOwned = Boolean(result.error && (
                    result.error.toLowerCase().includes('already') ||
                    result.error.toLowerCase().includes('zaten') ||
                    result.error.toLowerCase().includes('owned') ||
                    result.error.includes('ITEM_ALREADY_OWNED')
                ));

                if (isAlreadyOwned) {
                    try {
                        const info = await PurchaseService.getCustomerInfo();
                        const synced = await syncSubscriptionFromCustomerInfo(info);
                        if (synced) {
                            setAlertConfig({
                                visible: true,
                                title: 'Aboneliğiniz Aktif! 🎉',
                                message: 'Google Play hesabınızdaki mevcut Premium aboneliğiniz doğrulandı ve hesabınıza tanımlandı.',
                                type: 'success'
                            });
                            return;
                        }
                    } catch (syncErr) {
                        console.log('[STORE] Already owned sync error:', syncErr.message);
                    }
                }

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

    const handleRestorePurchases = async () => {
        setPurchasing(true);
        try {
            const customerInfo = await PurchaseService.restorePurchases();
            const isRestored = await syncSubscriptionFromCustomerInfo(customerInfo);
            if (isRestored) {
                setAlertConfig({
                    visible: true,
                    title: 'Başarılı! 🎉',
                    message: 'Satın alımlarınız ve Premium aboneliğiniz başarıyla geri yüklendi.',
                    type: 'success'
                });
            } else {
                setAlertConfig({
                    visible: true,
                    title: 'Bilgi',
                    message: 'Bu Google Play hesabına ait aktif bir abonelik veya geri yüklenebilir ürün bulunamadı.',
                    type: 'info'
                });
            }
        } catch (error) {
            setAlertConfig({
                visible: true,
                title: 'Hata',
                message: 'Geri yükleme işlemi sırasında bir hata oluştu: ' + (error.message || 'Lütfen tekrar deneyiniz.'),
                type: 'error'
            });
        } finally {
            setPurchasing(false);
        }
    };

    const selectedPlan = PREMIUM_PLANS[selectedPlanIndex];

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Dark Burgundy/Black Gradient Background */}
            <LinearGradient
                colors={STORE_THEME.colors.backgroundGradient}
                style={StyleSheet.absoluteFill}
            />

            <SafeAreaView style={styles.safeArea}>
                {/* 1. Header (Back button + Title + Wallet Chip) */}
                <StoreHeader
                    onBack={() => navigation.goBack()}
                    balance={balance}
                    onRecharge={() => navigation.navigate('Shop')}
                />

                {/* Main Scroll Content */}
                <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: tabOffset + 140 + insets.bottom }]}
                >
                    {/* Active Subscription Banner for Premium Users */}
                    {isPremium ? (
                        <ActiveSubscriptionBanner
                            startDate={currentUser?.premium_start_date || currentUser?.vip_start_date || currentUser?.created_at}
                            expireDate={premiumExpireDate || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()}
                        />
                    ) : null}

                    {/* 2. Hero Section */}
                    <PremiumHero />

                    {/* 3. Feature Grid (2 columns, compact cards) */}
                    <FeatureGrid />

                    {/* 4. Plan List (Vertical full-width rows with badges & dynamic savings) & 5. Social Proof */}
                    <PlanList
                        plans={PREMIUM_PLANS}
                        selectedIndex={selectedPlanIndex}
                        onSelectPlan={(idx) => setSelectedPlanIndex(idx)}
                        socialProofCount={WEEKLY_SOCIAL_PROOF}
                    />

                    {/* Restore Purchases & Subscription Management */}
                    <View style={styles.footerActionsContainer}>
                        <TouchableOpacity
                            style={styles.restoreButton}
                            onPress={handleRestorePurchases}
                            activeOpacity={0.7}
                            disabled={purchasing}
                        >
                            <Text style={styles.restoreButtonText}>Satın Alımları Geri Yükle</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelSubscriptionLink}
                            onPress={() => Linking.openURL('https://play.google.com/store/account/subscriptions')}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.cancelSubscriptionText}>
                                Abonelik İptali & Google Play Yönetimi
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                {/* 6. Sticky Bottom CTA Bar */}
                <StickyPurchaseBar
                    onPress={handlePurchaseCurrentPlan}
                    loading={purchasing}
                    buttonTitle={isPremium ? 'Aboneliği Uzat' : "Premium'a Geç"}
                    planLabel={selectedPlan ? `${selectedPlan.months} Ay · ${selectedPlan.price}` : ''}
                />

                {/* Alert Modal for errors */}
                <ModernAlert
                    visible={alertConfig.visible}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    type={alertConfig.type}
                    onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
                />

                {/* Celebration Modal for Premium Success */}
                <PremiumSuccessModal 
                    visible={premiumSuccessVisible}
                    planMonths={selectedPlan?.months || 1}
                    onClose={() => setPremiumSuccessVisible(false)}
                />
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0305',
    },
    safeArea: {
        flex: 1,
    },
    scrollContent: {
        // paddingBottom is now set dynamically in component
    },
    footerActionsContainer: {
        marginTop: 20,
        marginBottom: 10,
        alignItems: 'center',
        gap: 12,
    },
    restoreButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    restoreButtonText: {
        color: '#E0E0E0',
        fontSize: 13,
        fontWeight: '500',
    },
    cancelSubscriptionLink: {
        paddingVertical: 4,
    },
    cancelSubscriptionText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 12,
        textDecorationLine: 'underline',
    },
});
