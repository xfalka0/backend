import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    SafeAreaView,
    RefreshControl,
    Dimensions,
    Image,
    Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Haptics from 'expo-haptics';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert } from '../contexts/AlertContext';
import GlassCard from '../components/ui/GlassCard';

const { width } = Dimensions.get('window');

const WalletScreen = () => {
    const navigation = useNavigation();
    const { theme } = useTheme();
    const { showAlert } = useAlert();

    // Stats from server
    const [pendingBalance, setPendingBalance] = useState(0);
    const [lifetimeEarnings, setLifetimeEarnings] = useState(0);
    
    // UI states
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [withdrawHistory, setWithdrawHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('withdraw'); // 'withdraw' | 'exchange' | 'history'

    // Form inputs (Modal-based details sheet)
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [showPayoutModal, setShowPayoutModal] = useState(false);
    const [iban, setIban] = useState('');
    const [accountHolder, setAccountHolder] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Business Math Constants
    const DIAMONDS_PER_USD = 2000;
    const USD_TO_TRY = 46.00;

    // Withdrawal Packages (Minimum 5 USD / 10,000 Diamonds)
    const WITHDRAW_PACKAGES = [
        { id: 1, usd: 5.0, diamonds: 10000 },
        { id: 2, usd: 10.0, diamonds: 20000 },
        { id: 3, usd: 20.0, diamonds: 40000 },
        { id: 4, usd: 50.0, diamonds: 100000 },
        { id: 5, usd: 100.0, diamonds: 200000 },
        { id: 6, usd: 250.0, diamonds: 500000 },
        { id: 7, usd: 500.0, diamonds: 1000000 },
    ];

    // Gold Coin Trade Options (Diamonds to Gold Coins with rich bonuses)
    const EXCHANGES = [
        { id: 1, diamonds: 1000, coins: 1000, bonus: 100 },
        { id: 2, diamonds: 5000, coins: 5000, bonus: 600 },
        { id: 3, diamonds: 10000, coins: 10000, bonus: 1500 },
        { id: 4, diamonds: 50000, coins: 50000, bonus: 10000 },
    ];

    const fetchWalletData = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            // Fetch stats (balance, lifetime)
            const statsRes = await axios.get(`${API_URL}/operators/my/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (statsRes.data) {
                setPendingBalance(parseFloat(statsRes.data.pending_balance || 0));
                setLifetimeEarnings(parseFloat(statsRes.data.lifetime_earnings || 0));
            }

            // Fetch history
            const historyRes = await axios.get(`${API_URL}/operators/my/withdrawals`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (historyRes.data) {
                setWithdrawHistory(historyRes.data);
            }
        } catch (error) {
            console.error('[WALLET_DATA_FETCH_ERROR]', error);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            setLoading(true);
            fetchWalletData().finally(() => setLoading(false));
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchWalletData();
        setRefreshing(false);
    };

    // Auto-spacing IBAN Formatter
    const formatIbanInput = (text) => {
        let cleaned = text.replace(/\s+/g, '').toUpperCase();
        if (cleaned.length > 26) {
            cleaned = cleaned.substring(0, 26);
        }
        
        let formatted = '';
        if (cleaned.startsWith('TR')) {
            formatted = 'TR';
            let rest = cleaned.substring(2);
            for (let i = 0; i < rest.length; i++) {
                if (i > 0 && i % 4 === 0) {
                    formatted += ' ';
                }
                formatted += rest[i];
            }
        } else {
            formatted = cleaned;
        }
        
        setIban(formatted);
    };

    const handleSelectPackage = (pkg) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (pendingBalance < pkg.diamonds) {
            showAlert({
                title: 'Bakiye Yetersiz 🔒',
                message: `Bu paketi çekmek için ${pkg.diamonds.toLocaleString()} elmas gereklidir. Mevcut bakiyeniz: ${pendingBalance.toLocaleString()} elmas.`,
                type: 'warning'
            });
            return;
        }
        setSelectedPackage(pkg);
        setShowPayoutModal(true);
    };

    const submitWithdrawal = async () => {
        if (!selectedPackage) return;
        const cleanIban = iban.replace(/\s+/g, '');

        if (!cleanIban.startsWith('TR') || cleanIban.length !== 26) {
            showAlert({
                title: 'Geçersiz IBAN',
                message: 'Lütfen "TR" ile başlayan 26 haneli geçerli bir TR IBAN numarası girin.',
                type: 'warning'
            });
            return;
        }

        if (!accountHolder || accountHolder.trim().length < 5) {
            showAlert({
                title: 'Eksik Bilgi',
                message: 'Lütfen geçerli bir hesap sahibi adı soyadı girin.',
                type: 'warning'
            });
            return;
        }

        setSubmitting(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.post(`${API_URL}/operators/my/withdraw`, {
                amount: selectedPackage.diamonds,
                iban: cleanIban,
                accountHolder: accountHolder.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setShowPayoutModal(false);
                showAlert({
                    title: 'Tebrikler! 💸',
                    message: 'Para çekme talebiniz başarıyla alındı. Yönetici incelemesinin ardından hesabınıza yatırılacaktır.',
                    type: 'success'
                });
                
                await fetchWalletData();
                setActiveTab('history');
            }
        } catch (error) {
            console.error('[WITHDRAW_ERROR]', error);
            const errorMsg = error.response?.data?.error || 'Çekim talebi gönderilirken bir sunucu hatası oluştu.';
            showAlert({
                title: 'Hata',
                message: errorMsg,
                type: 'error'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleExchangeCoins = async (option) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (pendingBalance < option.diamonds) {
            showAlert({
                title: 'Bakiye Yetersiz 🔒',
                message: `Bu takas için ${option.diamonds.toLocaleString()} elmas gereklidir. Mevcut bakiyeniz: ${pendingBalance.toLocaleString()} elmas.`,
                type: 'warning'
            });
            return;
        }

        showAlert({
            title: 'Altın Para Takası 🪙',
            message: `${option.diamonds.toLocaleString()} Elmas karşılığında ${option.coins.toLocaleString()} (+${option.bonus.toLocaleString()} Bonus) Altın Para almak istiyor musunuz?`,
            type: 'info',
            showCancel: true,
            cancelText: 'Vazgeç',
            confirmText: 'Takas Et',
            onConfirm: async () => {
                setLoading(true);
                try {
                    const token = await AsyncStorage.getItem('token');
                    const response = await axios.post(`${API_URL}/operators/my/exchange-coins`, {
                        amount: option.diamonds,
                        coins: option.coins + option.bonus
                    }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    if (response.data.success) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        showAlert({
                            title: 'Başarılı! 🎉',
                            message: 'Elmaslarınız başarıyla altın paraya takas edildi. İyi sohbetler dileriz!',
                            type: 'success'
                        });
                        await fetchWalletData();
                    }
                } catch (error) {
                    console.error('[COINS_EXCHANGE_ERROR]', error);
                    showAlert({
                        title: 'Hata',
                        message: error.response?.data?.error || 'Takas işlemi gerçekleştirilirken bir hata oluştu.',
                        type: 'error'
                    });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    // Calculate aggregated secondary stats
    const processedWithdrawals = withdrawHistory
        .filter(w => w.status === 'processed')
        .reduce((sum, item) => sum + (parseFloat(item.amount) / DIAMONDS_PER_USD), 0);

    const pendingWithdrawals = withdrawHistory
        .filter(w => w.status === 'pending')
        .reduce((sum, item) => sum + (parseFloat(item.amount) / DIAMONDS_PER_USD), 0);

    const getStatusText = (status) => {
        switch (status) {
            case 'pending': return 'İnceleniyor';
            case 'processed': return 'Tamamlandı';
            case 'rejected': return 'Reddedildi';
            default: return status;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return '#a855f7'; // Purple/Fuchsia matching
            case 'processed': return '#10b981'; // Green
            case 'rejected': return '#ef4444'; // Red
            default: return '#6b7280';
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            
            {/* Background Image Layer with Fiva Banner */}
            <View style={styles.headerBackdrop}>
                <Image 
                    source={require('../../assets/fiva_profile_banner.png')} 
                    style={styles.backgroundImage}
                />
                <LinearGradient
                    colors={['rgba(219, 39, 119, 0.2)', 'rgba(124, 58, 237, 0.5)', '#09021a']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                />
                {/* Large Subtle Diamond Watermark in top-right */}
                <Ionicons name="diamond" size={280} color="rgba(255, 255, 255, 0.05)" style={styles.watermarkDiamond} />
            </View>

            <SafeAreaView style={styles.safeArea}>
                {/* Custom Navigation Header */}
                <View style={styles.navHeader}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={28} color="white" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>Cüzdanım</Text>
                        <TouchableOpacity onPress={() => setActiveTab('history')}>
                            <Text style={styles.headerLink}>Elmas detayları</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={{ width: 36 }} />
                </View>

                {/* Wallet Balance & Main Statistics */}
                <View style={styles.statsBanner}>
                    <View style={styles.balanceHeaderRow}>
                        <Text style={styles.balanceSub}>Elmas Bakiyesi ≈ ${(pendingBalance / DIAMONDS_PER_USD).toFixed(1)} USD</Text>
                        <Ionicons name="help-circle-outline" size={16} color="rgba(255,255,255,0.6)" />
                    </View>
                    <Text style={styles.balanceBig}>{Math.floor(pendingBalance).toLocaleString()}</Text>

                    <View style={styles.subStatsRow}>
                        <View style={styles.subStatItem}>
                            <Text style={styles.subStatLabel}>Para çekme</Text>
                            <Text style={styles.subStatValue}>${processedWithdrawals.toFixed(1)}</Text>
                        </View>
                        <View style={styles.subStatItem}>
                            <Text style={styles.subStatLabel}>İnceleniyor</Text>
                            <Text style={styles.subStatValue}>${pendingWithdrawals.toFixed(1)}</Text>
                        </View>
                    </View>
                </View>

                {/* Sliding Overlay Container (White Sheet) */}
                <View style={styles.contentOverlay}>
                    {/* Modern Tabs Bar */}
                    <View style={styles.tabBar}>
                        <TouchableOpacity 
                            style={styles.tabItem} 
                            onPress={() => setActiveTab('withdraw')}
                        >
                            <Text style={[styles.tabText, activeTab === 'withdraw' && styles.activeTabText]}>Çekim</Text>
                            {activeTab === 'withdraw' && <View style={styles.tabIndicator} />}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.tabItem} 
                            onPress={() => setActiveTab('exchange')}
                        >
                            <Text style={[styles.tabText, activeTab === 'exchange' && styles.activeTabText]}>Altın para takası</Text>
                            {activeTab === 'exchange' && <View style={styles.tabIndicator} />}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.tabItem} 
                            onPress={() => setActiveTab('history')}
                        >
                            <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>Geçmiş</Text>
                            {activeTab === 'history' && <View style={styles.tabIndicator} />}
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollList}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />
                        }
                    >
                        {loading ? (
                            <View style={styles.loaderBox}>
                                <ActivityIndicator size="large" color="#db2777" />
                                <Text style={styles.loaderText}>Yükleniyor...</Text>
                            </View>
                        ) : activeTab === 'withdraw' ? (
                            /* --- PAYOUT LIST TAB --- */
                            <View style={styles.tabContainer}>
                                {WITHDRAW_PACKAGES.map((pkg) => (
                                    <TouchableOpacity 
                                        key={pkg.id} 
                                        style={styles.packageCard}
                                        activeOpacity={0.8}
                                        onPress={() => handleSelectPackage(pkg)}
                                    >
                                        <View style={styles.packageLeft}>
                                            <Text style={styles.packageAmountBig}>{pkg.usd}</Text>
                                            <Text style={styles.packageCurrency}>USD</Text>
                                        </View>
                                        
                                        <View style={styles.packageRight}>
                                            <LinearGradient
                                                colors={['#f3e8ff', '#f5f3ff']}
                                                style={styles.diamondPill}
                                            >
                                                <Text style={styles.diamondPillText}>{pkg.diamonds.toLocaleString()}</Text>
                                                <Ionicons name="diamond" size={14} color="#7c3aed" />
                                            </LinearGradient>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : activeTab === 'exchange' ? (
                            /* --- GOLD COIN EXCHANGE TAB --- */
                            <View style={styles.tabContainer}>
                                <View style={styles.exchangeNotice}>
                                    <Ionicons name="sparkles" size={18} color="#db2777" />
                                    <Text style={styles.exchangeNoticeText}>
                                        Elmaslarınızı altın paraya dönüştürerek diğer kullanıcılarla konuşmada veya hediye göndermede kullanabilirsiniz! Üstelik yüksek bonus kazanırsınız.
                                    </Text>
                                </View>

                                {EXCHANGES.map((option) => (
                                    <TouchableOpacity 
                                        key={option.id} 
                                        style={styles.packageCard}
                                        activeOpacity={0.8}
                                        onPress={() => handleExchangeCoins(option)}
                                    >
                                        <View style={styles.exchangeLeft}>
                                            <View style={styles.exchangeCoinRow}>
                                                <Ionicons name="wallet" size={18} color="#eab308" />
                                                <Text style={styles.exchangeCoinText}>{(option.coins + option.bonus).toLocaleString()}</Text>
                                                <Text style={styles.coinLabel}>Altın</Text>
                                            </View>
                                            <View style={styles.bonusBadge}>
                                                <Text style={styles.bonusBadgeText}>+{option.bonus} BONUS</Text>
                                            </View>
                                        </View>
                                        
                                        <View style={styles.packageRight}>
                                            <LinearGradient
                                                colors={['#fdf2f8', '#fce7f3']}
                                                style={[styles.diamondPill, { borderColor: '#db2777' }]}
                                            >
                                                <Text style={[styles.diamondPillText, { color: '#db2777' }]}>{option.diamonds.toLocaleString()}</Text>
                                                <Ionicons name="diamond" size={14} color="#db2777" />
                                            </LinearGradient>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            /* --- DETAILED HISTORY LOGS TAB --- */
                            <View style={styles.tabContainer}>
                                {withdrawHistory.length === 0 ? (
                                    <View style={styles.emptyBox}>
                                        <Ionicons name="document-text-outline" size={48} color="#d1d5db" />
                                        <Text style={styles.emptyText}>Henüz çekim talebiniz bulunmuyor.</Text>
                                    </View>
                                ) : (
                                    withdrawHistory.map((item) => (
                                        <View key={item.id} style={styles.historyCard}>
                                            <View style={styles.historyHeader}>
                                                <View style={styles.historyTitle}>
                                                    <Ionicons name="diamond-outline" size={16} color="#7c3aed" />
                                                    <Text style={styles.historyDiamonds}>{parseFloat(item.amount).toLocaleString()} Elmas</Text>
                                                </View>
                                                <View style={[
                                                    styles.statusBadge, 
                                                    { backgroundColor: getStatusColor(item.status) + '15', borderColor: getStatusColor(item.status) }
                                                ]}>
                                                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                                                        {getStatusText(item.status)}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={styles.historyDivider} />

                                            <View style={styles.historyBody}>
                                                <View style={styles.historyRow}>
                                                    <Text style={styles.historyLabel}>Ödenecek Tutar:</Text>
                                                    <Text style={styles.historyValueTry}>
                                                        {parseFloat(item.cash_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
                                                    </Text>
                                                </View>
                                                <View style={styles.historyRow}>
                                                    <Text style={styles.historyLabel}>Hesap Sahibi:</Text>
                                                    <Text style={styles.historyValue} numberOfLines={1}>{item.account_holder}</Text>
                                                </View>
                                                <View style={styles.historyRow}>
                                                    <Text style={styles.historyLabel}>IBAN:</Text>
                                                    <Text style={[styles.historyValue, { fontFamily: 'monospace' }]}>
                                                        {item.iban.substring(0, 6)}...{item.iban.substring(item.iban.length - 4)}
                                                    </Text>
                                                </View>
                                                <View style={styles.historyRow}>
                                                    <Text style={styles.historyLabel}>Tarih:</Text>
                                                    <Text style={styles.historyValue}>
                                                        {new Date(item.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </Text>
                                                </View>
                                            </View>

                                            {item.status === 'rejected' && item.rejection_reason && (
                                                <View style={styles.rejectionNotice}>
                                                    <Ionicons name="alert-circle-outline" size={14} color="#ef4444" style={{ marginRight: 6, marginTop: 1 }} />
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.rejectionTitle}>Red Nedeni:</Text>
                                                        <Text style={styles.rejectionText}>{item.rejection_reason}</Text>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    ))
                                )}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </SafeAreaView>

            {/* DETAILED PAYOUT Modal (Slide-up Sheet) */}
            <Modal
                visible={showPayoutModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowPayoutModal(false)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalBackdrop}
                >
                    <TouchableOpacity 
                        style={styles.modalBgTap} 
                        activeOpacity={1} 
                        onPress={() => setShowPayoutModal(false)}
                    />
                    
                    <View style={styles.modalContainer}>
                        {/* Drag Handle indicator */}
                        <View style={styles.dragHandle} />

                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Çekim Detayları</Text>
                            <TouchableOpacity onPress={() => setShowPayoutModal(false)} style={styles.modalClose}>
                                <Ionicons name="close" size={24} color="#374151" />
                            </TouchableOpacity>
                        </View>

                        {selectedPackage && (
                            <View style={styles.packageSummary}>
                                <View style={styles.summaryBadge}>
                                    <Text style={styles.summaryBadgeText}>Seçilen Paket: ${selectedPackage.usd} USD</Text>
                                </View>
                                <View style={styles.summaryStats}>
                                    <View style={styles.summaryStatItem}>
                                        <Text style={styles.summaryLabel}>Tutar (TL):</Text>
                                        <Text style={styles.summaryValueBig}>{(selectedPackage.usd * USD_TO_TRY).toFixed(2)} TL</Text>
                                    </View>
                                    <View style={styles.summaryStatItem}>
                                        <Text style={styles.summaryLabel}>Düşecek Elmas:</Text>
                                        <Text style={[styles.summaryValueBig, { color: '#7c3aed' }]}>{selectedPackage.diamonds.toLocaleString()}</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalForm}>
                            {/* Account Name */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Hesap Sahibi Adı Soyadı</Text>
                                <View style={styles.formInputWrapper}>
                                    <Ionicons name="person-outline" size={18} color="#9ca3af" style={styles.formIcon} />
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Ad ve Soyadı girin"
                                        placeholderTextColor="#9ca3af"
                                        value={accountHolder}
                                        onChangeText={setAccountHolder}
                                        autoCapitalize="words"
                                        autoCorrect={false}
                                    />
                                </View>
                            </View>

                            {/* IBAN */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>TR IBAN Numarası</Text>
                                <View style={styles.formInputWrapper}>
                                    <Ionicons name="card-outline" size={18} color="#9ca3af" style={styles.formIcon} />
                                    <TextInput
                                        style={[styles.formInput, { fontFamily: 'monospace' }]}
                                        placeholder="TR00 0000 0000 0000 0000 0000 00"
                                        placeholderTextColor="#9ca3af"
                                        value={iban}
                                        onChangeText={formatIbanInput}
                                        maxLength={32}
                                        keyboardType="email-address"
                                        autoCapitalize="characters"
                                        autoCorrect={false}
                                    />
                                </View>
                            </View>

                            <View style={styles.disclaimerBox}>
                                <Ionicons name="information-circle-outline" size={16} color="#4b5563" style={{ marginRight: 6 }} />
                                <Text style={styles.disclaimerText}>
                                    Lütfen IBAN ve isim soyisim bilgilerinizin doğruluğundan emin olun. Hatalı transferler geri alınamaz. Çekimler genellikle 24 saat içinde tamamlanır.
                                </Text>
                            </View>

                            {submitting ? (
                                <View style={styles.submittingBox}>
                                    <ActivityIndicator size="small" color="#db2777" />
                                    <Text style={styles.submittingText}>Talep gönderiliyor...</Text>
                                </View>
                            ) : (
                                <TouchableOpacity 
                                    style={styles.modalSubmitBtn}
                                    onPress={submitWithdrawal}
                                >
                                    <LinearGradient
                                        colors={['#db2777', '#7c3aed']}
                                        style={styles.modalSubmitGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        <Text style={styles.modalSubmitBtnText}>Çekim Talebi Oluştur</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09021a'
    },
    safeArea: {
        flex: 1
    },
    headerBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 290,
        zIndex: 0
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    watermarkDiamond: {
        position: 'absolute',
        top: -60,
        right: -80,
        transform: [{ rotate: '15deg' }]
    },
    navHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        zIndex: 10
    },
    backButton: {
        padding: 4
    },
    headerTitleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 12
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '900'
    },
    headerLink: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '700',
        paddingBottom: 2
    },
    statsBanner: {
        paddingHorizontal: 24,
        paddingTop: 14,
        paddingBottom: 24,
        alignItems: 'center'
    },
    balanceHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    balanceSub: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 13,
        fontWeight: '700'
    },
    balanceBig: {
        color: 'white',
        fontSize: 48,
        fontWeight: '900',
        letterSpacing: -1,
        marginTop: 4
    },
    subStatsRow: {
        flexDirection: 'row',
        width: '100%',
        marginTop: 18,
        justifyContent: 'space-between'
    },
    subStatItem: {
        flex: 1,
        alignItems: 'center'
    },
    subStatLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontWeight: '700'
    },
    subStatValue: {
        color: 'white',
        fontSize: 18,
        fontWeight: '900',
        marginTop: 4
    },
    contentOverlay: {
        flex: 1,
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        overflow: 'hidden'
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        height: 52
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
    },
    tabText: {
        color: '#9ca3af',
        fontSize: 14,
        fontWeight: '800'
    },
    activeTabText: {
        color: '#7c3aed'
    },
    tabIndicator: {
        position: 'absolute',
        bottom: 0,
        width: 32,
        height: 3,
        backgroundColor: '#7c3aed',
        borderRadius: 1.5
    },
    scrollList: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 40
    },
    loaderBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80
    },
    loaderText: {
        color: '#9ca3af',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 10
    },
    tabContainer: {
        width: '100%'
    },
    packageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f9fafb',
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f3f4f6'
    },
    packageLeft: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6
    },
    packageAmountBig: {
        color: '#111827',
        fontSize: 24,
        fontWeight: '900'
    },
    packageCurrency: {
        color: '#4b5563',
        fontSize: 13,
        fontWeight: '800'
    },
    packageRight: {
        alignItems: 'flex-end'
    },
    diamondPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#ddd6fe',
        gap: 6
    },
    diamondPillText: {
        color: '#7c3aed',
        fontSize: 14,
        fontWeight: '900'
    },
    exchangeNotice: {
        flexDirection: 'row',
        backgroundColor: '#fdf2f8',
        borderRadius: 16,
        padding: 12,
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#fce7f3',
        marginBottom: 16
    },
    exchangeNoticeText: {
        flex: 1,
        color: '#be185d',
        fontSize: 11,
        lineHeight: 15,
        fontWeight: '700',
        marginLeft: 8
    },
    exchangeLeft: {
        flex: 1,
        gap: 4
    },
    exchangeCoinRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    exchangeCoinText: {
        color: '#111827',
        fontSize: 18,
        fontWeight: '900'
    },
    coinLabel: {
        color: '#eab308',
        fontSize: 11,
        fontWeight: '900'
    },
    bonusBadge: {
        backgroundColor: '#db2777',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6
    },
    bonusBadgeText: {
        color: 'white',
        fontSize: 8,
        fontWeight: '900'
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80
    },
    emptyText: {
        color: '#9ca3af',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 12
    },
    historyCard: {
        backgroundColor: '#f9fafb',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f3f4f6'
    },
    historyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    historyTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    historyDiamonds: {
        color: '#111827',
        fontSize: 15,
        fontWeight: '900'
    },
    statusBadge: {
        borderWidth: 1.5,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 10
    },
    statusText: {
        fontSize: 10,
        fontWeight: '900'
    },
    historyDivider: {
        height: 1,
        backgroundColor: '#e5e7eb',
        marginVertical: 12
    },
    historyBody: {
        gap: 8
    },
    historyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    historyLabel: {
        color: '#6b7280',
        fontSize: 12,
        fontWeight: '700'
    },
    historyValue: {
        color: '#374151',
        fontSize: 12,
        fontWeight: '700',
        maxWidth: '60%'
    },
    historyValueTry: {
        color: '#7c3aed',
        fontSize: 13,
        fontWeight: '900'
    },
    rejectionNotice: {
        flexDirection: 'row',
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        borderRadius: 12,
        padding: 10,
        marginTop: 12
    },
    rejectionTitle: {
        color: '#dc2626',
        fontSize: 10,
        fontWeight: '900'
    },
    rejectionText: {
        color: '#7f1d1d',
        fontSize: 11,
        lineHeight: 15,
        marginTop: 1,
        fontWeight: '600'
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    modalBgTap: {
        flex: 1
    },
    modalContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        maxHeight: '85%',
        paddingBottom: Platform.OS === 'ios' ? 24 : 16
    },
    dragHandle: {
        width: 40,
        height: 5,
        backgroundColor: '#e5e7eb',
        borderRadius: 2.5,
        alignSelf: 'center',
        marginTop: 10
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6'
    },
    modalTitle: {
        color: '#111827',
        fontSize: 16,
        fontWeight: '900'
    },
    modalClose: {
        padding: 4
    },
    packageSummary: {
        backgroundColor: '#f5f3ff',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 20,
        marginVertical: 16,
        borderWidth: 1,
        borderColor: '#ddd6fe'
    },
    summaryBadge: {
        backgroundColor: '#7c3aed',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginBottom: 12
    },
    summaryBadgeText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '900'
    },
    summaryStats: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    summaryStatItem: {
        flex: 1
    },
    summaryValueBig: {
        color: '#111827',
        fontSize: 18,
        fontWeight: '900',
        marginTop: 2
    },
    modalForm: {
        paddingHorizontal: 20,
        paddingBottom: 30
    },
    formGroup: {
        marginBottom: 16
    },
    formLabel: {
        color: '#374151',
        fontSize: 12,
        fontWeight: '800',
        marginBottom: 8,
        marginLeft: 4
    },
    formInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 52
    },
    formIcon: {
        marginRight: 8
    },
    formInput: {
        flex: 1,
        color: '#111827',
        fontSize: 14,
        fontWeight: '700',
        height: '100%'
    },
    disclaimerBox: {
        flexDirection: 'row',
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        padding: 12,
        alignItems: 'flex-start',
        marginBottom: 24
    },
    disclaimerText: {
        flex: 1,
        color: '#4b5563',
        fontSize: 10,
        lineHeight: 14,
        fontWeight: '600'
    },
    submittingBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12
    },
    submittingText: {
        color: '#6b7280',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 6
    },
    modalSubmitBtn: {
        borderRadius: 16,
        overflow: 'hidden'
    },
    modalSubmitGradient: {
        height: 52,
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalSubmitBtnText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '900'
    }
});

export default WalletScreen;
