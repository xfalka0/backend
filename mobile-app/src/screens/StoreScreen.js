import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, StatusBar } from 'react-native';
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

const PREMIUM_PLANS = [
    { months: 1, badge: 'BAŞLANGIÇ', price: '449,99 ₺', productId: 'premium_1_month' },
    { months: 3, badge: 'POPÜLER', price: '969,99 ₺', productId: 'premium_3_months' },
    { months: 6, badge: 'EN AVANTAJLI', price: '1499,99 ₺', productId: 'premium_6_months' },
];

const WEEKLY_SOCIAL_PROOF = '2.340';

export default function StoreScreen({ navigation, route }) {
    const { user } = route.params || {};
    const insets = useSafeAreaInsets();
    const tabOffset = LAYOUT.tabBarHeight + LAYOUT.tabBarBottomOffset;

    const [balance, setBalance] = useState(user?.balance || 0);
    const [purchasing, setPurchasing] = useState(false);
    
    const defaultIndex = Math.max(0, PREMIUM_PLANS.findIndex(p => p.badge === 'POPÜLER'));
    const [selectedPlanIndex, setSelectedPlanIndex] = useState(defaultIndex);
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'info' });

    // Fetch user balance
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

    useEffect(() => {
        fetchBalance();
    }, []);

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
                await axios.post(`${API_URL}/vip/upgrade-direct`, {
                    months: plan.months,
                    transactionId: result.customerInfo?.originalAppUserId || `rc_${Date.now()}`
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                }).catch(err => console.log('Backend sync error:', err.message));

                setAlertConfig({
                    visible: true,
                    title: 'Tebrikler!',
                    message: `${plan.months} Aylık Premium paketiniz başarıyla aktifleştirildi. Tüm ayrıcalıkların tadını çıkarın!`,
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
                </ScrollView>

                {/* 6. Sticky Bottom CTA Bar */}
                <StickyPurchaseBar
                    onPress={handlePurchaseCurrentPlan}
                    loading={purchasing}
                    planLabel={selectedPlan ? `${selectedPlan.months} Ay · ${selectedPlan.price}` : ''}
                />

                {/* Alert Modal */}
                <ModernAlert
                    visible={alertConfig.visible}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    type={alertConfig.type}
                    onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
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
});
