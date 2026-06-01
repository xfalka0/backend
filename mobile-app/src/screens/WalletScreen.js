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
    RefreshControl
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert } from '../contexts/AlertContext';

const WalletScreen = () => {
    const navigation = useNavigation();
    const { theme, themeMode } = useTheme();
    const { showAlert } = useAlert();

    // Stats
    const [pendingBalance, setPendingBalance] = useState(0);
    const [lifetimeEarnings, setLifetimeEarnings] = useState(0);
    const [weeklyStats, setWeeklyStats] = useState([]);
    
    // Withdrawal Form
    const [iban, setIban] = useState('');
    const [accountHolder, setAccountHolder] = useState('');
    const [amount, setAmount] = useState('');
    
    // UI states
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [withdrawHistory, setWithdrawHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('withdraw'); // 'withdraw' | 'history'

    // Monetization rates
    const DIAMONDS_PER_USD = 2000;
    const USD_TO_TRY = 46.00;
    const MIN_WITHDRAWAL_DIAMONDS = 5000;

    const fetchWalletData = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            // Fetch operator stats (balance, earnings, today's count)
            const statsRes = await axios.get(`${API_URL}/operators/my/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (statsRes.data) {
                setPendingBalance(parseFloat(statsRes.data.pending_balance || 0));
                setLifetimeEarnings(parseFloat(statsRes.data.lifetime_earnings || 0));
                setWeeklyStats(statsRes.data.weekly_stats || []);
            }

            // Fetch operator withdrawal history
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

    // Formatter for IBAN spacing: TRXX XXXX XXXX XXXX XXXX XXXX XX
    const formatIbanInput = (text) => {
        let cleaned = text.replace(/\s+/g, '').toUpperCase();
        if (cleaned.length > 26) {
            cleaned = cleaned.substring(0, 26);
        }
        
        // Split into chunks of 4 characters, starting after TR
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

    const handleWithdrawSubmit = async () => {
        const cleanIban = iban.replace(/\s+/g, '');
        const withdrawAmount = parseInt(amount);

        // Validation
        if (isNaN(withdrawAmount) || withdrawAmount < MIN_WITHDRAWAL_DIAMONDS) {
            showAlert({
                title: 'Hata',
                message: `Minimum çekim tutarı ${MIN_WITHDRAWAL_DIAMONDS.toLocaleString()} elmastır.`,
                type: 'warning'
            });
            return;
        }

        if (withdrawAmount > pendingBalance) {
            showAlert({
                title: 'Bakiye Yetersiz',
                message: `Çekmek istediğiniz tutar mevcut bakiyenizden (${pendingBalance.toLocaleString()} elmas) fazladır.`,
                type: 'warning'
            });
            return;
        }

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

        // Calculation preview
        const usdVal = withdrawAmount / DIAMONDS_PER_USD;
        const tlVal = usdVal * USD_TO_TRY;

        showAlert({
            title: 'Çekim Talebi',
            message: `${withdrawAmount.toLocaleString()} Elmas (${tlVal.toFixed(2)} TL) çekim talebi oluşturulsun mu? Çekilen bakiye hesabınızdan hemen düşecektir.`,
            type: 'info',
            onConfirm: async () => {
                setLoading(true);
                try {
                    const token = await AsyncStorage.getItem('token');
                    const response = await axios.post(`${API_URL}/operators/my/withdraw`, {
                        amount: withdrawAmount,
                        iban: cleanIban,
                        accountHolder: accountHolder.trim()
                    }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    if (response.data.success) {
                        showAlert({
                            title: 'Tebrikler!',
                            message: 'Çekim talebiniz başarıyla alındı. Yönetici onayının ardından IBAN hesabınıza yatırılacaktır.',
                            type: 'success'
                        });
                        
                        // Clear form
                        setAmount('');
                        
                        // Refresh data
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
                    setLoading(false);
                }
            }
        });
    };

    // Calculate conversions for real-time preview
    const inputAmount = parseInt(amount) || 0;
    const previewUsd = inputAmount / DIAMONDS_PER_USD;
    const previewTry = previewUsd * USD_TO_TRY;
    const currentTlValue = (pendingBalance / DIAMONDS_PER_USD) * USD_TO_TRY;

    const getStatusText = (status) => {
        switch (status) {
            case 'pending': return 'Beklemede';
            case 'processed': return 'Tamamlandı';
            case 'rejected': return 'Reddedildi';
            default: return status;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return '#fbbf24'; // Amber
            case 'processed': return '#10b981'; // Green
            case 'rejected': return '#ef4444'; // Red
            default: return '#6b7280';
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            <StatusBar barStyle="light-content" />
            
            {/* Dynamic Background Banner */}
            <View style={styles.bgWrapper}>
                <LinearGradient
                    colors={['#8b5cf6', '#4c1d95', '#0f0720']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
            </View>

            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={28} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>ELMAS CÜZDANIM</Text>
                    <View style={{ width: 36 }} />
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
                    }
                >
                    {/* Diamond Hub Card */}
                    <View style={styles.glassCardWrapper}>
                        <LinearGradient
                            colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.03)']}
                            style={styles.walletHubCard}
                        >
                            <View style={styles.hubHeader}>
                                <View style={styles.hubTitleBox}>
                                    <View style={styles.diamondCircle}>
                                        <Ionicons name="diamond" size={22} color="#22d3ee" />
                                    </View>
                                    <View>
                                        <Text style={styles.hubSubtitle}>Mevcut Çekilebilir Elmas</Text>
                                        <Text style={styles.hubBalanceText}>{pendingBalance.toLocaleString()}</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.dividerLine} />

                            <View style={styles.hubStatsGrid}>
                                <View style={styles.hubStatItem}>
                                    <Text style={styles.hubStatLabel}>Tahmini TL Karşılığı</Text>
                                    <Text style={styles.hubStatValue}>{currentTlValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL</Text>
                                </View>
                                <View style={styles.hubStatVerticalDivider} />
                                <View style={styles.hubStatItem}>
                                    <Text style={styles.hubStatLabel}>Toplam Ödenen</Text>
                                    <Text style={[styles.hubStatValue, { color: '#10b981' }]}>
                                        {((lifetimeEarnings / DIAMONDS_PER_USD) * USD_TO_TRY).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} TL
                                    </Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </View>

                    {/* Navigation Tabs */}
                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={[styles.tabButton, activeTab === 'withdraw' && styles.activeTabButton]}
                            onPress={() => setActiveTab('withdraw')}
                        >
                            <Ionicons name="cash-outline" size={18} color={activeTab === 'withdraw' ? '#fff' : 'rgba(255,255,255,0.4)'} />
                            <Text style={[styles.tabButtonText, activeTab === 'withdraw' && styles.activeTabButtonText]}>Para Çek</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={[styles.tabButton, activeTab === 'history' && styles.activeTabButton]}
                            onPress={() => setActiveTab('history')}
                        >
                            <Ionicons name="receipt-outline" size={18} color={activeTab === 'history' ? '#fff' : 'rgba(255,255,255,0.4)'} />
                            <Text style={[styles.tabButtonText, activeTab === 'history' && styles.activeTabButtonText]}>Geçmiş Talepler</Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color="#a855f7" />
                            <Text style={styles.loadingText}>Yükleniyor...</Text>
                        </View>
                    ) : activeTab === 'withdraw' ? (
                        /* WITHDRAW TAB */
                        <View style={styles.tabContent}>
                            <View style={styles.inputCard}>
                                <Text style={styles.inputCardTitle}>IBAN Çekim Talebi</Text>
                                <Text style={styles.inputCardSubtitle}>
                                    Kazançlarınızı TR IBAN hesabınıza çekin. Çekim talepleri genellikle 24 saat içinde işleme alınır.
                                </Text>

                                {/* Account Holder Name */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Hesap Sahibi Adı Soyadı</Text>
                                    <View style={styles.inputWrapper}>
                                        <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="Ad Soyad girin"
                                            placeholderTextColor="rgba(255,255,255,0.3)"
                                            value={accountHolder}
                                            onChangeText={setAccountHolder}
                                            autoCapitalize="words"
                                            autoCorrect={false}
                                        />
                                    </View>
                                </View>

                                {/* IBAN */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>IBAN Numarası</Text>
                                    <View style={styles.inputWrapper}>
                                        <Ionicons name="card-outline" size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
                                        <TextInput
                                            style={[styles.textInput, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}
                                            placeholder="TR00 0000 0000 0000 0000 0000 00"
                                            placeholderTextColor="rgba(255,255,255,0.3)"
                                            value={iban}
                                            onChangeText={formatIbanInput}
                                            maxLength={34} // Account for TR (2) + digits (24) + spaces (6) = 32 max
                                            keyboardType="email-address" // Avoid autocorrect or decimal keys
                                            autoCapitalize="characters"
                                            autoCorrect={false}
                                        />
                                    </View>
                                </View>

                                {/* Amount */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Çekilecek Elmas Tutarı</Text>
                                    <View style={styles.inputWrapper}>
                                        <Ionicons name="diamond-outline" size={18} color="rgba(255,255,255,0.4)" style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder={`Min ${MIN_WITHDRAWAL_DIAMONDS.toLocaleString()} Elmas`}
                                            placeholderTextColor="rgba(255,255,255,0.3)"
                                            value={amount}
                                            onChangeText={setAmount}
                                            keyboardType="number-pad"
                                        />
                                        <TouchableOpacity 
                                            style={styles.maxButton} 
                                            onPress={() => setAmount(String(Math.floor(pendingBalance)))}
                                        >
                                            <Text style={styles.maxButtonText}>HEPSİ</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Real-time Preview Banner */}
                                {inputAmount >= MIN_WITHDRAWAL_DIAMONDS && (
                                    <LinearGradient
                                        colors={['rgba(34, 211, 238, 0.15)', 'rgba(139, 92, 246, 0.15)']}
                                        style={styles.previewBanner}
                                    >
                                        <View style={styles.previewItem}>
                                            <Text style={styles.previewLabel}>Tutar (USD):</Text>
                                            <Text style={styles.previewValue}>${previewUsd.toFixed(2)}</Text>
                                        </View>
                                        <View style={styles.previewDivider} />
                                        <View style={styles.previewItem}>
                                            <Text style={styles.previewLabel}>Alacağınız Tutar:</Text>
                                            <Text style={[styles.previewValue, { color: '#22d3ee', fontWeight: '900' }]}>
                                                {previewTry.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                                            </Text>
                                        </View>
                                    </LinearGradient>
                                )}

                                {/* Rules and terms alerts */}
                                <View style={styles.infoAlert}>
                                    <Ionicons name="information-circle-outline" size={18} color="#94a3b8" />
                                    <Text style={styles.infoAlertText}>
                                        Fiva elmas kur oranı sabittir: <Text style={{ color: '#fff', fontWeight: 'bold' }}>2000 Elmas = 1 Dolar</Text>. 
                                        Dolar kuru anlık olarak <Text style={{ color: '#fff', fontWeight: 'bold' }}>46.00 TL</Text> üzerinden Türk Lirasına çevrilerek IBAN hesabınıza gönderilir.
                                    </Text>
                                </View>

                                {/* Withdraw Button */}
                                <TouchableOpacity 
                                    style={styles.submitButton}
                                    onPress={handleWithdrawSubmit}
                                >
                                    <LinearGradient
                                        colors={['#c084fc', '#8b5cf6']}
                                        style={styles.submitGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        <Text style={styles.submitButtonText}>Para Çekme Talebini Gönder</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        /* HISTORY TAB */
                        <View style={styles.tabContent}>
                            {withdrawHistory.length === 0 ? (
                                <View style={styles.emptyHistoryBox}>
                                    <Ionicons name="document-text-outline" size={48} color="rgba(255,255,255,0.15)" />
                                    <Text style={styles.emptyHistoryText}>Henüz hiç çekim talebiniz bulunmuyor.</Text>
                                </View>
                            ) : (
                                withdrawHistory.map((item) => (
                                    <View key={item.id} style={styles.historyCard}>
                                        <View style={styles.historyHeader}>
                                            <View style={styles.historyTitleBox}>
                                                <Ionicons name="diamond" size={16} color="#22d3ee" />
                                                <Text style={styles.historyAmountText}>
                                                    {parseFloat(item.amount).toLocaleString()} Elmas
                                                </Text>
                                            </View>
                                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '22', borderColor: getStatusColor(item.status) }]}>
                                                <Text style={[styles.statusBadgeText, { color: getStatusColor(item.status) }]}>
                                                    {getStatusText(item.status)}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.historyDivider} />

                                        <View style={styles.historyGrid}>
                                            <View style={styles.historyRow}>
                                                <Text style={styles.historyLabel}>Ödenen Tutar:</Text>
                                                <Text style={[styles.historyValue, { color: '#fff', fontWeight: 'bold' }]}>
                                                    {parseFloat(item.cash_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL
                                                </Text>
                                            </View>
                                            <View style={styles.historyRow}>
                                                <Text style={styles.historyLabel}>Hesap Sahibi:</Text>
                                                <Text style={styles.historyValue} numberOfLines={1}>{item.account_holder}</Text>
                                            </View>
                                            <View style={styles.historyRow}>
                                                <Text style={styles.historyLabel}>IBAN:</Text>
                                                <Text style={[styles.historyValue, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11 }]} numberOfLines={1}>
                                                    {item.iban.substring(0, 6)}...{item.iban.substring(item.iban.length - 4)}
                                                </Text>
                                            </View>
                                            <View style={styles.historyRow}>
                                                <Text style={styles.historyLabel}>Tarih:</Text>
                                                <Text style={styles.historyValue}>
                                                    {new Date(item.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </Text>
                                            </View>
                                        </View>

                                        {item.status === 'rejected' && item.rejection_reason && (
                                            <View style={styles.rejectionBox}>
                                                <Ionicons name="warning-outline" size={14} color="#ef4444" style={{ marginRight: 6, marginTop: 1 }} />
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
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    safeArea: {
        flex: 1
    },
    bgWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 280,
        zIndex: 0
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        zIndex: 10
    },
    backButton: {
        padding: 4
    },
    headerTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 2
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 40
    },
    glassCardWrapper: {
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 20,
        elevation: 10,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12
    },
    walletHubCard: {
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)'
    },
    hubHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    hubTitleBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14
    },
    diamondCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: 'rgba(34, 211, 238, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(34, 211, 238, 0.3)'
    },
    hubSubtitle: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        fontWeight: '600'
    },
    hubBalanceText: {
        color: 'white',
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: 0.5,
        marginTop: 2
    },
    dividerLine: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginVertical: 18
    },
    hubStatsGrid: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    hubStatItem: {
        flex: 1
    },
    hubStatLabel: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5
    },
    hubStatValue: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800',
        marginTop: 4
    },
    hubStatVerticalDivider: {
        width: 1,
        height: 32,
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginHorizontal: 12
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: 4,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8
    },
    activeTabButton: {
        backgroundColor: 'rgba(255,255,255,0.08)'
    },
    tabButtonText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        fontWeight: '700'
    },
    activeTabButtonText: {
        color: 'white'
    },
    tabContent: {
        width: '100%'
    },
    inputCard: {
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    inputCardTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800'
    },
    inputCardSubtitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        lineHeight: 16,
        marginTop: 6,
        marginBottom: 20
    },
    inputGroup: {
        marginBottom: 16
    },
    inputLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 8,
        marginLeft: 4
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 52
    },
    inputIcon: {
        marginRight: 10
    },
    textInput: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        height: '100%'
    },
    maxButton: {
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.3)'
    },
    maxButtonText: {
        color: '#c084fc',
        fontSize: 10,
        fontWeight: '900'
    },
    previewBanner: {
        flexDirection: 'row',
        borderRadius: 14,
        padding: 14,
        marginVertical: 6,
        marginBottom: 16,
        alignItems: 'center'
    },
    previewItem: {
        flex: 1,
        alignItems: 'center'
    },
    previewLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontWeight: '700'
    },
    previewValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
        marginTop: 2
    },
    previewDivider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.1)'
    },
    infoAlert: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
        borderRadius: 14,
        padding: 12,
        alignItems: 'flex-start',
        marginBottom: 20
    },
    infoAlertText: {
        flex: 1,
        color: '#94a3b8',
        fontSize: 10,
        lineHeight: 14,
        marginLeft: 8
    },
    submitButton: {
        borderRadius: 14,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6
    },
    submitGradient: {
        height: 52,
        alignItems: 'center',
        justifyContent: 'center'
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    emptyHistoryBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        backgroundColor: 'rgba(255,255,255,0.01)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)'
    },
    emptyHistoryText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 12,
        textAlign: 'center'
    },
    loadingBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 50
    },
    loadingText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        marginTop: 10
    },
    historyCard: {
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)'
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    historyTitleBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    historyAmountText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800'
    },
    statusBadge: {
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '800'
    },
    historyDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginVertical: 12
    },
    historyGrid: {
        gap: 8
    },
    historyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    historyLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 11,
        fontWeight: '600'
    },
    historyValue: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '600',
        maxWidth: '60%'
    },
    rejectionBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
        borderRadius: 10,
        padding: 10,
        marginTop: 12
    },
    rejectionTitle: {
        color: '#ef4444',
        fontSize: 10,
        fontWeight: '800'
    },
    rejectionText: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 11,
        lineHeight: 15,
        marginTop: 2
    }
});

export default WalletScreen;
