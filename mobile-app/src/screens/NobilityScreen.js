import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    SafeAreaView,
    ActivityIndicator,
    Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAlert } from '../contexts/AlertContext';
import { Motion } from '../components/motion/MotionSystem';

const { width } = Dimensions.get('window');

const TITLE_THEMES = {
    knight: {
        gradient: ['#1e293b', '#0f172a'],
        accent: '#A7C7FF',
        badgeColor: '#A7C7FF',
        glow: 'rgba(167, 199, 255, 0.25)',
        benefits: [
            'Özel Gümüş Mavi isim rengi',
            'Şövalye profil ve chat rozeti',
            'Sohbette öne çıkma'
        ]
    },
    baron: {
        gradient: ['#2e1065', '#0f172a'],
        accent: '#B46CFF',
        badgeColor: '#B46CFF',
        glow: 'rgba(180, 108, 255, 0.3)',
        benefits: [
            'Özel Asil Mor isim rengi',
            'Baron profil ve chat rozeti',
            'Chat listesinde öncelik',
            'Prestijli profil görünümü'
        ]
    },
    king: {
        gradient: ['#422006', '#0f172a'],
        accent: '#FFD166',
        badgeColor: '#FFD166',
        glow: 'rgba(255, 209, 102, 0.35)',
        benefits: [
            'Özel Altın Sarı isim rengi',
            'Kral profil ve chat rozeti',
            'Chat listesinde yüksek öncelik',
            'Üye listesinde üst sıralarda yer alma'
        ]
    },
    duke: {
        gradient: ['#500730', '#0f172a'],
        accent: '#FF4D8D',
        badgeColor: '#FF4D8D',
        glow: 'rgba(255, 77, 141, 0.4)',
        benefits: [
            'Özel Pembe Eflatun isim rengi',
            'Dük profil ve chat rozeti',
            'Sohbette üstün öncelik',
            'Üye listesinde en üst sıralar'
        ]
    },
    emperor: {
        gradient: ['#450a0a', '#020617', '#000000'],
        accent: '#FFB84D',
        badgeColor: '#FFB84D',
        glow: 'rgba(255, 184, 77, 0.45)',
        benefits: [
            'Özel İmparator Turuncusu isim rengi',
            'İmparator profil ve chat rozeti',
            'Tüm sohbetlerde mutlak öncelik',
            'Üye listesinde en üstte listelenme',
            'Zirvedeki prestij statüsü'
        ]
    }
};

export default function NobilityScreen({ navigation }) {
    const { showAlert } = useAlert();
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [titles, setTitles] = useState([]);
    const [activeNobility, setActiveNobility] = useState(null);
    const [userBalance, setUserBalance] = useState(0);
    const [selectedTitle, setSelectedTitle] = useState(null);
    const [token, setToken] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const userToken = await AsyncStorage.getItem('token');
            setToken(userToken);

            const headers = { Authorization: `Bearer ${userToken}` };

            // Fetch active nobility
            const meRes = await axios.get(`${API_URL}/nobility/me`, { headers });
            setActiveNobility(meRes.data);

            // Fetch balance
            const balRes = await axios.get(`${API_URL}/users/balance`, { headers });
            setUserBalance(balRes.data.balance || 0);

            // Fetch titles
            const titlesRes = await axios.get(`${API_URL}/nobility/titles`, { headers });
            setTitles(titlesRes.data);

            // Set default selected title (either active title or Knight)
            if (meRes.data) {
                const active = titlesRes.data.find(t => t.id === meRes.data.title_id);
                setSelectedTitle(active || titlesRes.data[0]);
            } else {
                setSelectedTitle(titlesRes.data[0]);
            }
        } catch (err) {
            console.error('[Nobility Screen] Load Error:', err);
            showAlert({ title: 'Hata', message: 'Asalet bilgileri yüklenemedi.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async (title) => {
        if (actionLoading) return;

        if (userBalance < title.price) {
            showAlert({ title: 'Yetersiz Bakiye', message: 'Bu unvanı almak için yeterli altının yok.', type: 'error' });
            return;
        }

        setActionLoading(true);
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const isUpgrade = activeNobility && title.level > activeNobility.level;
            
            const res = await axios.post(`${API_URL}/nobility/purchase`, { titleId: title.id }, { headers });
            
            showAlert({
                title: 'Başarılı!',
                message: res.data.message || (isUpgrade ? 'Asalet unvanın yükseltildi.' : 'Asalet unvanın aktif edildi.'),
                type: 'success'
            });

            // Update local state
            setActiveNobility(res.data.nobility);
            setUserBalance(res.data.new_balance);
        } catch (err) {
            const errorMsg = err.response?.data?.error || 'Satın alma işlemi başarısız oldu.';
            showAlert({ title: 'İşlem Başarısız', message: errorMsg, type: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleRenew = async (title) => {
        if (actionLoading) return;

        if (userBalance < title.price) {
            showAlert({ title: 'Yetersiz Bakiye', message: 'Bu unvanı almak için yeterli altının yok.', type: 'error' });
            return;
        }

        setActionLoading(true);
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const res = await axios.post(`${API_URL}/nobility/renew`, { titleId: title.id }, { headers });
            
            showAlert({
                title: 'Başarılı!',
                message: 'Asalet unvanın yenilendi.',
                type: 'success'
            });

            // Update local state
            setActiveNobility(res.data.nobility);
            setUserBalance(res.data.new_balance);
        } catch (err) {
            const errorMsg = err.response?.data?.error || 'Yenileme işlemi başarısız oldu.';
            showAlert({ title: 'İşlem Başarısız', message: errorMsg, type: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <LinearGradient colors={['#0f172a', '#020617']} style={StyleSheet.absoluteFill} />
                <ActivityIndicator size="large" color="#FFD166" />
                <Text style={styles.loadingText}>Asalet yükleniyor...</Text>
            </View>
        );
    }

    const activeTheme = TITLE_THEMES[selectedTitle?.key] || TITLE_THEMES.knight;
    const isOwned = activeNobility && activeNobility.title_id === selectedTitle?.id;
    const isHigher = activeNobility && selectedTitle?.level > activeNobility.level;
    const isLower = activeNobility && selectedTitle?.level < activeNobility.level;

    // Remaining days calculation
    let remainingDays = 0;
    if (activeNobility) {
        const expires = new Date(activeNobility.expires_at);
        const diffTime = expires.getTime() - new Date().getTime();
        remainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient
                colors={[`${activeTheme.accent}15`, '#020617']}
                style={StyleSheet.absoluteFill}
            />

            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={28} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>ASALET MERKEZİ</Text>
                    <View style={styles.balanceContainer}>
                        <Ionicons name="logo-bitcoin" size={16} color="#FFD166" />
                        <Text style={styles.balanceText}>{userBalance}</Text>
                    </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    
                    {/* Active Nobility Status */}
                    <Motion.SlideUp delay={100}>
                        <View style={styles.activeSection}>
                            {activeNobility ? (
                                <LinearGradient
                                    colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                                    style={styles.activeCard}
                                >
                                    <View style={styles.activeCardHeader}>
                                        <View style={[styles.badgeIndicator, { backgroundColor: TITLE_THEMES[activeNobility.key]?.accent }]}>
                                            <Ionicons name="shield-checkmark" size={18} color="white" />
                                        </View>
                                        <View style={styles.activeTitleInfo}>
                                            <Text style={styles.activeLabel}>Aktif Unvanın</Text>
                                            <Text style={[styles.activeTitleName, { color: activeNobility.name_color }]}>
                                                {activeNobility.name}
                                            </Text>
                                        </View>
                                        <View style={styles.remainingBadge}>
                                            <Text style={styles.remainingText}>{remainingDays} Gün kaldı</Text>
                                        </View>
                                    </View>

                                    <View style={styles.activeCardFooter}>
                                        <Text style={styles.purchasedPrice}>
                                            Ödenen Fiyat: {activeNobility.purchased_price} Altın
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.quickRenewButton}
                                            onPress={() => {
                                                const titleObj = titles.find(t => t.id === activeNobility.title_id);
                                                if (titleObj) handleRenew(titleObj);
                                            }}
                                            disabled={actionLoading}
                                        >
                                            <Text style={styles.quickRenewText}>Yenile</Text>
                                        </TouchableOpacity>
                                    </View>
                                </LinearGradient>
                            ) : (
                                <View style={styles.noActiveCard}>
                                    <Text style={styles.noActiveTitle}>Henüz bir asalet unvanın yok.</Text>
                                    <Text style={styles.noActiveSubtitle}>
                                        Aşağıdan bir unvan seçerek profilinde prestijini göster.
                                    </Text>
                                </View>
                            )}
                        </View>
                    </Motion.SlideUp>

                    {/* Premium Title Carousel / Selector */}
                    <View style={styles.selectorContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
                            {titles.map((title) => {
                                const theme = TITLE_THEMES[title.key] || TITLE_THEMES.knight;
                                const isSelected = selectedTitle?.id === title.id;
                                return (
                                    <TouchableOpacity
                                        key={title.id}
                                        onPress={() => setSelectedTitle(title)}
                                        style={[
                                            styles.titleSelectorCard,
                                            isSelected && { borderColor: theme.accent, shadowColor: theme.glow, elevation: 10 }
                                        ]}
                                    >
                                        <LinearGradient
                                            colors={isSelected ? theme.gradient : ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.01)']}
                                            style={styles.selectorCardGradient}
                                        >
                                            <Ionicons name="ribbon-outline" size={24} color={theme.accent} />
                                            <Text style={[styles.selectorTitleName, { color: isSelected ? 'white' : '#64748b' }]}>
                                                {title.name}
                                            </Text>
                                            <Text style={styles.selectorLevelText}>Lvl {title.level}</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Big Showcase Card for selected title */}
                    {selectedTitle && (
                        <Motion.Bounce visible={true}>
                            <View style={[styles.showcaseWrapper, { shadowColor: activeTheme.glow }]}>
                                <LinearGradient
                                    colors={activeTheme.gradient}
                                    style={styles.showcaseCard}
                                >
                                    {/* Accent border glow */}
                                    <View style={[styles.showcaseHeader, { borderBottomColor: `${activeTheme.accent}30` }]}>
                                        <View>
                                            <Text style={[styles.showcaseName, { color: activeTheme.accent }]}>
                                                {selectedTitle.name}
                                            </Text>
                                            <Text style={styles.showcaseDuration}>Geçerlilik: {selectedTitle.duration_days} Gün</Text>
                                        </View>
                                        <View style={styles.showcasePriceContainer}>
                                            <Ionicons name="logo-bitcoin" size={18} color="#FFD166" />
                                            <Text style={styles.showcasePrice}>{selectedTitle.price}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.benefitsSection}>
                                        <Text style={styles.benefitsHeading}>UNVAN AYRICALIKLARI</Text>
                                        {activeTheme.benefits.map((benefit, i) => (
                                            <View key={i} style={styles.benefitRow}>
                                                <Ionicons name="checkmark-circle-outline" size={16} color={activeTheme.accent} />
                                                <Text style={styles.benefitText}>{benefit}</Text>
                                            </View>
                                        ))}
                                    </View>

                                    {/* Action button inside card */}
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => {
                                            if (isOwned) {
                                                handleRenew(selectedTitle);
                                            } else {
                                                handlePurchase(selectedTitle);
                                            }
                                        }}
                                        disabled={actionLoading || isLower}
                                    >
                                        <LinearGradient
                                            colors={isLower ? ['#334155', '#1e293b'] : (isOwned ? ['#059669', '#065f46'] : [activeTheme.accent, `${activeTheme.accent}aa`])}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.actionGradient}
                                        >
                                            {actionLoading ? (
                                                <ActivityIndicator size="small" color="white" />
                                            ) : (
                                                <Text style={[styles.actionButtonText, isLower && { color: '#64748b' }]}>
                                                    {isOwned ? 'SÜREYİ UZAT (YENİLE)' : (isHigher ? 'UNVANI YÜKSELT' : (isLower ? 'Zaten Üst Unvana Sahipsin' : 'SATIN AL'))}
                                                </Text>
                                            )}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </LinearGradient>
                            </View>
                        </Motion.Bounce>
                    )}

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    safeArea: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: 'white',
        marginTop: 10,
        fontSize: 14,
        fontWeight: 'bold',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        color: 'white',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 2,
    },
    balanceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 209, 102, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 209, 102, 0.2)',
    },
    balanceText: {
        color: '#FFD166',
        fontSize: 13,
        fontWeight: 'bold',
        marginLeft: 5,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    activeSection: {
        paddingHorizontal: 20,
        marginTop: 10,
        marginBottom: 20,
    },
    activeCard: {
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    activeCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    badgeIndicator: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeTitleInfo: {
        flex: 1,
        marginLeft: 15,
    },
    activeLabel: {
        color: '#64748b',
        fontSize: 11,
        fontWeight: '700',
    },
    activeTitleName: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 2,
    },
    remainingBadge: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    remainingText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    activeCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    purchasedPrice: {
        color: '#64748b',
        fontSize: 12,
    },
    quickRenewButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    quickRenewText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    noActiveCard: {
        backgroundColor: 'rgba(255,255,255,0.01)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.03)',
        alignItems: 'center',
    },
    noActiveTitle: {
        color: 'white',
        fontSize: 15,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    noActiveSubtitle: {
        color: '#475569',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 16,
    },
    selectorContainer: {
        marginBottom: 25,
    },
    selectorScroll: {
        paddingHorizontal: 20,
        gap: 12,
    },
    titleSelectorCard: {
        width: 105,
        height: 105,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    selectorCardGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
    },
    selectorTitleName: {
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 8,
    },
    selectorLevelText: {
        color: '#475569',
        fontSize: 10,
        fontWeight: 'bold',
        marginTop: 4,
    },
    showcaseWrapper: {
        marginHorizontal: 20,
        borderRadius: 28,
        elevation: 20,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        overflow: 'visible',
    },
    showcaseCard: {
        borderRadius: 28,
        padding: 24,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    showcaseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 20,
        borderBottomWidth: 1,
    },
    showcaseName: {
        fontSize: 24,
        fontWeight: '900',
    },
    showcaseDuration: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 4,
    },
    showcasePriceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 209, 102, 0.05)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 209, 102, 0.1)',
    },
    showcasePrice: {
        color: '#FFD166',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 6,
    },
    benefitsSection: {
        marginVertical: 24,
    },
    benefitsHeading: {
        color: '#475569',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 15,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    benefitText: {
        color: '#94a3b8',
        fontSize: 13,
        marginLeft: 10,
        fontWeight: '500',
    },
    actionButton: {
        width: '100%',
        height: 54,
        borderRadius: 27,
        overflow: 'hidden',
    },
    actionGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionButtonText: {
        color: '#020617',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1,
    }
});
