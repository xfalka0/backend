import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    SafeAreaView,
    StatusBar,
    RefreshControl,
    Image,
    ActivityIndicator,
    Modal,
    TextInput,
    Alert,
    Animated,
    Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Haptics from 'expo-haptics';

import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import GlassCard from '../components/ui/GlassCard';
import SafeLottie from '../components/ui/SafeLottie';
import { useAppStore } from '../store/useAppStore';

import { resolveImageUrl } from '../utils/imageUtils';

const { width } = Dimensions.get('window');

const WEEKS = [
    { label: 'Mevcut Hafta', offset: 0 },
    { label: 'Geçen Hafta', offset: 1 },
    { label: '2 Hafta Önce', offset: 2 },
    { label: '3 Hafta Önce', offset: 3 }
];

const getWeekDateRangeStr = (offset) => {
    const today = new Date();
    const day = today.getDay();
    const diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1);
    
    const monday = new Date(today.getFullYear(), today.getMonth(), diffToMonday - (offset * 7));
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    
    const format = (d) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}`;
    };
    
    return `${format(monday)} - ${format(sunday)}`;
};

function OperatorDetailsModal({ visible, op, onClose, onRemove }) {
    if (!op) return null;

    const [imageError, setImageError] = useState(false);
    useEffect(() => {
        setImageError(false);
    }, [op]);

    const resolvedUrl = op.avatar_url ? resolveImageUrl(op.avatar_url) : null;
    const hasAvatar = resolvedUrl && !imageError;

    const formattedDate = op.joined_at 
        ? new Date(op.joined_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'Bilinmiyor';

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.detailsBackdrop}>
                <GlassCard intensity={60} tint="dark" style={styles.detailsCard}>
                    {/* Header */}
                    <View style={styles.detailsHeader}>
                        <View style={styles.detailsAvatarContainer}>
                            {hasAvatar ? (
                                <Image
                                    source={{ uri: resolvedUrl }}
                                    style={styles.detailsAvatar}
                                    onError={() => setImageError(true)}
                                />
                            ) : (
                                <View style={styles.detailsAvatarPlaceholder}>
                                    <Ionicons name="person" size={40} color="rgba(255, 255, 255, 0.4)" />
                                </View>
                            )}
                            <View style={[
                                styles.detailsOnlineDot, 
                                { backgroundColor: op.is_online ? '#10b981' : '#64748b' }
                            ]} />
                        </View>
                        <Text style={styles.detailsName} numberOfLines={1}>
                            {op.display_name || op.username}
                        </Text>
                        <View style={styles.detailsIdBadge}>
                            <Text style={styles.detailsIdText}>ID: {op.id}</Text>
                        </View>
                    </View>

                    {/* Stats Rows */}
                    <View style={styles.detailsStatsGrid}>
                        <View style={styles.detailsStatRow}>
                            <View style={styles.detailsStatIconBox}>
                                <Ionicons name="calendar-outline" size={18} color="#a855f7" />
                            </View>
                            <View style={styles.detailsStatContent}>
                                <Text style={styles.detailsStatLabel}>Katılım Tarihi</Text>
                                <Text style={styles.detailsStatValue}>{formattedDate}</Text>
                            </View>
                        </View>

                        <View style={styles.detailsStatRow}>
                            <View style={styles.detailsStatIconBox}>
                                <Ionicons name="star" size={18} color="#fbbf24" />
                            </View>
                            <View style={styles.detailsStatContent}>
                                <Text style={styles.detailsStatLabel}>Rating Puanı</Text>
                                <Text style={styles.detailsStatValue}>{parseFloat(op.rating || 5.0).toFixed(1)} / 5.0</Text>
                            </View>
                        </View>

                        <View style={styles.detailsStatRow}>
                            <View style={styles.detailsStatIconBox}>
                                <Ionicons name="sparkles" size={18} color="#f59e0b" />
                            </View>
                            <View style={styles.detailsStatContent}>
                                <Text style={styles.detailsStatLabel}>Bugünkü Gelir</Text>
                                <Text style={styles.detailsStatValue}>{op.today_commission || 0} Elmas</Text>
                            </View>
                        </View>

                        <View style={styles.detailsStatRow}>
                            <View style={styles.detailsStatIconBox}>
                                <Ionicons name="wallet-outline" size={18} color="#10b981" />
                            </View>
                            <View style={styles.detailsStatContent}>
                                <Text style={styles.detailsStatLabel}>Haftalık Gelir</Text>
                                <Text style={styles.detailsStatValue}>
                                    {op.weekly_commission || 0} Elmas (${((op.weekly_commission || 0) / 2000).toFixed(2)})
                                </Text>
                            </View>
                        </View>

                        <View style={styles.detailsStatRow}>
                            <View style={styles.detailsStatIconBox}>
                                <Ionicons name="radio-button-on-outline" size={18} color={op.is_online ? '#10b981' : '#94a3b8'} />
                            </View>
                            <View style={styles.detailsStatContent}>
                                <Text style={styles.detailsStatLabel}>Durum</Text>
                                <Text style={[styles.detailsStatValue, { color: op.is_online ? '#10b981' : '#cbd5e1' }]}>
                                    {op.is_online ? 'Çevrimiçi' : 'Çevrimdışı'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {op.is_low_quality ? (
                        <View style={styles.detailsWarning}>
                            <Ionicons name="warning-outline" size={16} color="#fbbf24" style={{ marginRight: 6 }} />
                            <Text style={styles.detailsWarningText}>Yayıncı kalitesi düşük seviyede!</Text>
                        </View>
                    ) : null}

                    {/* Actions */}
                    <View style={styles.detailsActions}>
                        <TouchableOpacity style={[styles.detailsBtn, styles.detailsCloseBtn]} onPress={onClose}>
                            <Text style={styles.detailsCloseText}>Kapat</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.detailsBtn, styles.detailsRemoveBtn]} onPress={() => {
                            onClose();
                            onRemove(op.id, op.display_name || op.username);
                        }}>
                            <Text style={styles.detailsRemoveText}>Ajanstan Çıkar</Text>
                        </TouchableOpacity>
                    </View>
                </GlassCard>
            </View>
        </Modal>
    );
}

function OperatorCard({ op, handleRemoveOperator, selectedWeek, onPressDetails }) {
    const [imageError, setImageError] = useState(false);
    const shortId = String(op.id).slice(-9).toUpperCase();
    
    const resolvedUrl = op.avatar_url ? resolveImageUrl(op.avatar_url) : null;
    const hasAvatar = resolvedUrl && !imageError;

    const formattedDate = op.joined_at 
        ? new Date(op.joined_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'Bilinmiyor';

    return (
        <GlassCard
            intensity={25}
            tint="dark"
            style={styles.opCardPremium}
            colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.01)']}
        >
            <View style={styles.opRowPremium}>
                {/* Avatar Left */}
                <View style={styles.avatarWrapperPremium}>
                    {hasAvatar ? (
                        <Image
                            source={{ uri: resolvedUrl }}
                            style={styles.avatarPremium}
                            onError={() => setImageError(true)}
                        />
                    ) : (
                        <View style={styles.avatarPlaceholderPremium}>
                            <Ionicons name="person" size={28} color="rgba(255, 255, 255, 0.4)" />
                        </View>
                    )}
                    <View style={[
                        styles.onlineIndicatorPremium, 
                        { backgroundColor: op.is_online ? '#10b981' : '#64748b' }
                    ]} />
                </View>

                {/* Details Right */}
                <View style={styles.detailsColPremium}>
                    <View style={styles.detailRowPremium}>
                        <Text style={styles.detailLabelPremium}>Ad :</Text>
                        <Text style={styles.detailValuePremium}>{op.display_name || op.username}</Text>
                    </View>
                    {selectedWeek === 0 && (
                        <View style={styles.detailRowPremium}>
                            <Text style={styles.detailLabelPremium}>Bugün :</Text>
                            <Text style={styles.detailValueDiamondsPremium}>{op.today_commission || 0} 💎</Text>
                        </View>
                    )}
                    <View style={styles.detailRowPremium}>
                        <Text style={styles.detailLabelPremium}>Haftalık Gelir :</Text>
                        <Text style={styles.detailValueDiamondsPremium}>
                            {op.weekly_commission || 0} 💎 (${((op.weekly_commission || 0) / 2000).toFixed(2)})
                        </Text>
                    </View>
                    <View style={styles.detailRowPremium}>
                        <Text style={styles.detailLabelPremium}>Katılım Tarihi :</Text>
                        <Text style={styles.detailValuePremium}>{formattedDate}</Text>
                    </View>

                    {/* Bottom Action Row */}
                    <View style={styles.bottomRowPremium}>
                        <View style={styles.idBadgePremium}>
                            <Text style={styles.idBadgeTextPremium}>ID:{shortId}</Text>
                        </View>
                        
                        <View style={styles.actionButtonsRow}>
                            <TouchableOpacity
                                style={styles.removeBtnPremium}
                                activeOpacity={0.7}
                                onPress={() => handleRemoveOperator(op.id, op.display_name || op.username)}
                            >
                                <Ionicons name="trash-outline" size={16} color="#f43f5e" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionBtnPremium}
                                activeOpacity={0.8}
                                onPress={() => onPressDetails(op)}
                            >
                                <LinearGradient
                                    colors={['#a855f7', '#ec4899']}
                                    style={styles.actionBtnGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Text style={styles.actionBtnText}>Detaylar</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </GlassCard>
    );
}

export default function AgencyDashboardScreen() {
    const navigation = useNavigation();
    const { theme, themeMode } = useTheme();
    
    // Connect Zustand Store
    const user = useAppStore(state => state.user);

    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState({
        agency: {
            id: '',
            name: '', // Empty default so it uses the 'Ajans Paneli' placeholder while loading
            referral_code: '',
            pending_balance: 0,
            lifetime_earnings: 0,
            commission_rate: 0.40,
            status: 'active'
        },
        stats: {
            today_diamonds: 0,
            active_operators: 0,
            total_operators: 0
        },
        operators: []
    });

    const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
    const [selectedOperatorForDetails, setSelectedOperatorForDetails] = useState(null);
    const [inviteIdentifier, setInviteIdentifier] = useState('');
    const [inviting, setInviting] = useState(false);

    // Pulse animation for skeleton loading state
    const [pulseAnim] = useState(new Animated.Value(0.3));
    const [selectedWeek, setSelectedWeek] = useState(0);

    useEffect(() => {
        let animation;
        if (loading) {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 0.7,
                        duration: 1000,
                        useNativeDriver: true
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 0.3,
                        duration: 1000,
                        useNativeDriver: true
                    })
                ])
            );
            animation.start();
        }
        return () => {
            if (animation) {
                animation.stop();
            }
        };
    }, [loading]);

    const handleSendInvite = async () => {
        if (!inviteIdentifier.trim()) {
            Alert.alert('Hata', 'Lütfen yayıncının kullanıcı adını, ID\'sini veya telefon numarasını girin.');
            return;
        }

        setInviting(true);
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const res = await axios.post(`${API_URL}/agency/invitations`, {
                targetIdentifier: inviteIdentifier.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data && res.data.success) {
                Alert.alert('Başarılı', res.data.message || 'Davet başarıyla gönderildi.');
                setInviteIdentifier('');
                setIsInviteModalVisible(false);
                fetchDashboardData();
            } else {
                Alert.alert('Hata', res.data?.error || 'Davet gönderilemedi.');
            }
        } catch (error) {
            console.error('[AgencyDashboard] Invite error:', error);
            const errMsg = error.response?.data?.error || 'Bir hata oluştu, lütfen daha sonra tekrar deneyin.';
            Alert.alert('Hata', errMsg);
        } finally {
            setInviting(false);
        }
    };

    const handleRemoveOperator = async (operatorId, operatorName) => {
        Alert.alert(
            'Yayıncıyı Ajans Dışı Bırak',
            `"${operatorName}" adlı yayıncıyı ajansınızdan çıkarmak istediğinize emin misiniz? Bu işlem geri alınamaz.`,
            [
                { text: 'İptal', style: 'cancel' },
                { 
                    text: 'Evet, Çıkar', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('token');
                            if (!token) return;

                            const res = await axios.post(`${API_URL}/agency/remove-operator`, {
                                operatorId
                            }, {
                                headers: { Authorization: `Bearer ${token}` }
                            });

                            if (res.data && res.data.success) {
                                Alert.alert('Başarılı', res.data.message || 'Yayıncı ajansınızdan çıkarıldı.');
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                fetchDashboardData(); // Refresh list
                            } else {
                                Alert.alert('Hata', res.data?.error || 'Yayıncı çıkarılamadı.');
                            }
                        } catch (error) {
                            console.error('[AgencyDashboard] Remove operator error:', error);
                            const errMsg = error.response?.data?.error || 'Bir hata oluştu, yayıncı çıkarılamadı.';
                            Alert.alert('Hata', errMsg);
                        }
                    }
                }
            ]
        );
    };

    const fetchDashboardData = async (weekOffset = selectedWeek) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const res = await axios.get(`${API_URL}/agency/my-dashboard?weekOffset=${weekOffset}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.data) {
                setDashboardData(res.data);
            }
        } catch (error) {
            console.error('[AgencyDashboard] Fetch dashboard error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData(selectedWeek);
    }, [selectedWeek]);

    const onRefresh = async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await fetchDashboardData();
        setRefreshing(false);
    };


    const renderSkeleton = () => {
        return (
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Skeleton Balance Card */}
                <Animated.View style={[styles.skeletonCard, { opacity: pulseAnim }]}>
                    <View style={styles.skeletonTextTitle} />
                    <View style={styles.skeletonTextBalance} />
                    <View style={styles.skeletonTextSub} />
                </Animated.View>

                {/* Skeleton Stats Grid */}
                <View style={styles.statsGrid}>
                    <Animated.View style={[styles.skeletonMiniCard, { opacity: pulseAnim }]}>
                        <View style={styles.skeletonIcon} />
                        <View style={{ gap: 6, flex: 1 }}>
                            <View style={styles.skeletonLineShort} />
                            <View style={styles.skeletonLineMedium} />
                        </View>
                    </Animated.View>
                    <Animated.View style={[styles.skeletonMiniCard, { opacity: pulseAnim }]}>
                        <View style={styles.skeletonIcon} />
                        <View style={{ gap: 6, flex: 1 }}>
                            <View style={styles.skeletonLineShort} />
                            <View style={styles.skeletonLineMedium} />
                        </View>
                    </Animated.View>
                </View>

                {/* Skeleton Section Header */}
                <View style={[styles.sectionHeader, { marginTop: 25 }]}>
                    <View style={{ gap: 6, flex: 1 }}>
                        <View style={styles.skeletonLineShort} />
                        <View style={styles.skeletonLineMedium} />
                    </View>
                </View>

                {/* Skeleton Operators list */}
                {[1, 2, 3].map((key) => (
                    <Animated.View key={key} style={[styles.skeletonOperatorCard, { opacity: pulseAnim }]}>
                        <View style={styles.skeletonAvatar} />
                        <View style={{ gap: 6, flex: 1 }}>
                            <View style={styles.skeletonLineMedium} />
                            <View style={styles.skeletonLineShort} />
                        </View>
                        <View style={{ gap: 6, alignItems: 'flex-end' }}>
                            <View style={styles.skeletonLineShort} />
                            <View style={styles.skeletonLineMedium} />
                        </View>
                    </Animated.View>
                ))}
            </ScrollView>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            
            {/* Fiva Banner Backdrop Layer */}
            <View style={styles.bgWrapper}>
                <Image 
                    source={require('../../assets/fiva_profile_banner.png')} 
                    style={styles.backgroundImage}
                />
                <LinearGradient
                    colors={
                        themeMode === 'dark'
                            ? ['rgba(9, 2, 26, 0.1)', 'rgba(9, 2, 26, 0.6)', '#09021a']
                            : ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.6)', '#09021a']
                    }
                    style={StyleSheet.absoluteFill}
                />
            </View>

            <SafeAreaView style={styles.safeArea}>
                {/* Header Row */}
                <View style={styles.headerRow}>
                    <TouchableOpacity 
                        style={styles.backButton}
                        onPress={() => navigation.goAsync ? navigation.goAsync() : navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerLabel}>AJANS YÖNETİMİ</Text>
                        <View style={styles.titleWithBadgeRow}>
                            <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>
                                {(dashboardData.agency?.name || 'Ajans Paneli').toUpperCase()}
                            </Text>
                            {dashboardData.agency?.name ? (
                                <View style={[
                                    styles.statusBadge,
                                    { 
                                        borderColor: dashboardData.agency?.status === 'active' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
                                        shadowColor: dashboardData.agency?.status === 'active' ? '#10b981' : '#f43f5e'
                                    }
                                ]}>
                                    <View style={[styles.statusDot, { backgroundColor: dashboardData.agency?.status === 'active' ? '#10b981' : '#f43f5e' }]} />
                                    <Text style={styles.statusText}>{dashboardData.agency?.status === 'active' ? 'Aktif' : 'Pasif'}</Text>
                                </View>
                            ) : null}
                        </View>
                        {dashboardData.agency?.id ? (
                            <Text style={styles.headerAgencyIdText}>
                                ID: {dashboardData.agency.id} {dashboardData.agency.referral_code ? ` | Ajans Kodu: ${dashboardData.agency.referral_code}` : ''}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {loading ? (
                    renderSkeleton()
                ) : (
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9333ea" />
                        }
                    >
                        {/* Summary Header Card */}
                        <GlassCard 
                            intensity={45} 
                            tint="dark" 
                            style={styles.summaryCard}
                            colors={['rgba(255, 255, 255, 0.07)', 'rgba(255, 255, 255, 0.02)']}
                        >
                            <Text style={styles.summaryTitle}>Toplam Bekleyen Hakediş</Text>
                            
                            <View style={styles.balanceContainer}>
                                <Text style={styles.balanceText}>
                                    ${((dashboardData.agency?.pending_balance || 0) / 2000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                                </Text>
                            </View>

                            {/* Mevcut/Seçili Hafta Kazancı */}
                            <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', fontWeight: '700' }}>
                                    {selectedWeek === 0 ? 'Mevcut Hafta Kazancı:' : `${WEEKS.find(w => w.offset === selectedWeek)?.label} Kazancı:`}
                                </Text>
                                <Text style={{ fontSize: 13, color: '#38bdf8', fontWeight: '800' }}>
                                    ${((dashboardData.stats?.weekly_diamonds || 0) / 2000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                                </Text>
                            </View>
                        </GlassCard>

                        {/* Stats Grid Layout */}
                        <View style={styles.statsGrid}>
                             <View style={styles.miniStatCardSolid}>
                                 <View style={styles.statIconWrapperYellow}>
                                     <Ionicons name="sparkles" size={16} color="#fbbf24" />
                                 </View>
                                 <View style={styles.statInfo}>
                                     <Text style={styles.statLabel}>Bugün Kazanılan</Text>
                                     <Text style={styles.statValue}>{dashboardData.stats?.today_diamonds?.toLocaleString()} Elmas</Text>
                                 </View>
                             </View>

                             <View style={styles.miniStatCardSolid}>
                                 <View style={styles.statIconWrapperGreen}>
                                     <Ionicons name="people" size={16} color="#10b981" />
                                 </View>
                                 <View style={styles.statInfo}>
                                     <Text style={styles.statLabel}>Aktif Yayıncı</Text>
                                     <Text style={styles.statValue}>{dashboardData.stats?.active_operators} / {dashboardData.stats?.total_operators}</Text>
                                 </View>
                             </View>
                         </View>

                        {/* Yayıncılar Listesi Butonu */}
                        <TouchableOpacity
                             style={styles.publishersListBtn}
                             activeOpacity={0.8}
                             onPress={() => navigation.navigate('AgencyOperators')}
                         >
                            <LinearGradient
                                colors={['#a855f7', '#7c3aed']}
                                style={styles.publishersListGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <View style={styles.publishersListLeft}>
                                    <Ionicons name="people" size={20} color="#fff" style={{ marginRight: 10 }} />
                                    <Text style={styles.publishersListBtnText}>Yayıncılar Listesi</Text>
                                </View>
                                <View style={styles.publishersListRight}>
                                    <View style={styles.publisherCountBadge}>
                                        <Text style={styles.publisherCountBadgeText}>
                                            {dashboardData.operators?.length || 0}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="#fff" />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Yeni Yayıncı Davet Et Butonu */}
                        <TouchableOpacity
                            style={styles.quickInviteBtn}
                            activeOpacity={0.8}
                            onPress={() => setIsInviteModalVisible(true)}
                        >
                            <View style={styles.quickInviteContent}>
                                <Ionicons name="person-add" size={18} color="#a855f7" style={{ marginRight: 8 }} />
                                <Text style={styles.quickInviteText}>Yeni Yayıncı Davet Et</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Haftalık Seçim Filtresi */}
                        <View style={styles.weekSelectorContainer}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.weekSelectorScroll}
                            >
                                {WEEKS.map((w) => {
                                    const isActive = selectedWeek === w.offset;
                                    return (
                                        <TouchableOpacity
                                            key={w.offset}
                                            style={[
                                                styles.weekPill,
                                                isActive && styles.weekPillActive
                                            ]}
                                            activeOpacity={0.8}
                                            onPress={() => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                setSelectedWeek(w.offset);
                                            }}
                                        >
                                            <Text style={[
                                                styles.weekPillText,
                                                isActive && styles.weekPillTextActive
                                            ]}>
                                                {w.label}
                                            </Text>
                                            <Text style={[
                                                styles.weekPillSubtext,
                                                isActive && styles.weekPillSubtextActive
                                            ]}>
                                                {getWeekDateRangeStr(w.offset)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* Section Header: Yayıncılarım */}
                        <View style={[styles.sectionHeader, { marginTop: 15 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={styles.sectionTitle}>Yayıncılarım</Text>
                                <View style={styles.publisherCountBadge}>
                                    <Text style={styles.publisherCountBadgeText}>
                                        {dashboardData.operators?.length || 0}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Operators List */}
                        {(!dashboardData.operators || dashboardData.operators.length === 0) ? (
                            <View style={[styles.emptyCard, { marginTop: 0, marginBottom: 20 }]}>
                                <Ionicons name="people-outline" size={48} color="rgba(255, 255, 255, 0.2)" />
                                <Text style={styles.emptyText}>
                                    Henüz ajansınıza bağlı bir yayıncı bulunmamaktadır.
                                </Text>
                            </View>
                        ) : (
                            dashboardData.operators.map((op) => (
                                <OperatorCard 
                                    key={op.id} 
                                    op={op} 
                                    handleRemoveOperator={handleRemoveOperator} 
                                    selectedWeek={selectedWeek}
                                    onPressDetails={(operator) => setSelectedOperatorForDetails(operator)}
                                />
                            ))
                        )}

                        <View style={{ height: 120 }} />
                    </ScrollView>
                )}
            </SafeAreaView>

            {/* Invite Operator Modal */}
            <Modal
                visible={isInviteModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsInviteModalVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <TouchableOpacity 
                        style={StyleSheet.absoluteFill} 
                        activeOpacity={1} 
                        onPress={() => setIsInviteModalVisible(false)} 
                    />
                    <GlassCard intensity={40} tint="dark" style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalIconCircle}>
                                <Ionicons name="person-add" size={24} color="#a855f7" />
                            </View>
                            <Text style={styles.modalTitle}>Yayıncı Davet Et</Text>
                            <Text style={styles.modalSubtitle}>
                                Kadın yayıncının kullanıcı adını, ID'sini veya telefon numarasını girerek ajansınıza davet edin.
                            </Text>
                        </View>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Kullanıcı adı, ID veya Telefon"
                            placeholderTextColor="rgba(255, 255, 255, 0.4)"
                            value={inviteIdentifier}
                            onChangeText={setInviteIdentifier}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity 
                                style={[styles.modalBtn, styles.modalCancelBtn]} 
                                onPress={() => {
                                    setInviteIdentifier('');
                                    setIsInviteModalVisible(false);
                                }}
                                disabled={inviting}
                            >
                                <Text style={styles.modalCancelText}>İptal</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.modalBtn}
                                onPress={handleSendInvite}
                                disabled={inviting}
                            >
                                <LinearGradient
                                    colors={['#8b5cf6', '#ec4899']}
                                    style={styles.modalSubmitGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    {inviting ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.modalSubmitText}>Davet Gönder</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </GlassCard>
                </View>
            </Modal>

            {/* Operator Details Modal */}
            <OperatorDetailsModal
                visible={selectedOperatorForDetails !== null}
                op={selectedOperatorForDetails}
                onClose={() => setSelectedOperatorForDetails(null)}
                onRemove={handleRemoveOperator}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09021a'
    },
    weekSelectorContainer: {
        marginTop: 10,
        marginBottom: 10,
    },
    weekSelectorScroll: {
        paddingRight: 20,
        gap: 8,
    },
    weekPill: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 110,
    },
    weekPillActive: {
        backgroundColor: 'rgba(147, 51, 234, 0.2)',
        borderColor: '#a855f7',
    },
    weekPillText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: '700',
    },
    weekPillTextActive: {
        color: '#fff',
        fontWeight: '800',
    },
    weekPillSubtext: {
        fontSize: 9,
        color: 'rgba(255, 255, 255, 0.35)',
        fontWeight: '600',
        marginTop: 2,
    },
    weekPillSubtextActive: {
        color: '#c084fc',
        fontWeight: '700',
    },
    miniStatCardSolid: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2d1b54',
        backgroundColor: '#150b2e',
        gap: 10,
    },
    statIconWrapperYellow: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#2e1d05',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statIconWrapperGreen: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#062b1a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    safeArea: {
        flex: 1,
    },
    bgWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 380,
        zIndex: 0,
        overflow: 'hidden',
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 15 : 15,
        paddingBottom: 15,
        zIndex: 10
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15
    },
    headerTitleContainer: {
        flex: 1
    },
    headerLabel: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.5
    },
    titleWithBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        flexWrap: 'wrap',
        gap: 8,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
        elevation: 4
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6
    },
    statusText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 10,
        textTransform: 'uppercase'
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    loaderText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 15
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10
    },
    summaryCard: {
        padding: 16,
        borderRadius: 24,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)'
    },
    summaryTitle: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    balanceContainer: {
        marginTop: 8
    },
    balanceText: {
        color: '#fff',
        fontSize: 26,
        fontWeight: '900',
        letterSpacing: -0.5,
        textShadowColor: 'rgba(255, 255, 255, 0.2)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
    },
    usdtText: {
        color: '#38bdf8',
        fontSize: 12,
        fontWeight: '800',
        marginTop: 2,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 25,
    },
    miniStatCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        gap: 8,
    },
    statIconWrapper: {
        width: 28,
        height: 28,
        borderRadius: 10,
        backgroundColor: 'rgba(251, 191, 36, 0.12)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    statInfo: {
        flex: 1,
    },
    statLabel: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    statValue: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '900',
        marginTop: 1
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: -0.2
    },
    commissionRateText: {
        color: '#a855f7',
        fontSize: 10,
        fontWeight: '800'
    },
    emptyCard: {
        padding: 30,
        paddingVertical: 40,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        marginTop: 10
    },
    emptyAnimationContainer: {
        width: 140,
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    emptyLottie: {
        width: 140,
        height: 140,
    },
    emptyText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        textAlign: 'center',
        marginTop: 15,
        lineHeight: 20
    },
    emptySub: {
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 6,
        paddingHorizontal: 15,
        lineHeight: 16
    },
    largeInviteBtn: {
        marginTop: 24,
        width: '100%',
        maxWidth: 260,
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    largeInviteGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    largeInviteBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    operatorCard: {
        padding: 16,
        borderRadius: 24,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)'
    },
    operatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    avatarWrapper: {
        position: 'relative'
    },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)'
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#09021a'
    },
    opInfo: {
        flex: 1
    },
    opName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        textTransform: 'capitalize'
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3
    },
    opRole: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 10,
        fontWeight: '700'
    },
    metaDivider: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        marginHorizontal: 6
    },
    opRating: {
        color: '#fbbf24',
        fontSize: 10,
        fontWeight: '800'
    },
    commissionSection: {
        alignItems: 'flex-end'
    },
    todayCommissionLabel: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase'
    },
    todayCommissionValue: {
        color: '#10b981',
        fontSize: 13,
        fontWeight: '950',
        marginTop: 2
    },
    todayCommissionTl: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 1
    },
    inviteButton: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    inviteGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    inviteButtonText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '900',
    },
    nameBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    lowQualityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(251, 191, 36, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.25)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    lowQualityText: {
        color: '#fbbf24',
        fontSize: 9,
        fontWeight: '850',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 28,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    modalIconCircle: {
        width: 50,
        height: 50,
        borderRadius: 16,
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.3,
    },
    modalSubtitle: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 16,
    },
    modalInput: {
        width: '100%',
        height: 48,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 14,
        paddingHorizontal: 16,
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 20,
    },
    modalActions: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    modalBtn: {
        flex: 1,
        height: 44,
        borderRadius: 14,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCancelBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.04)',
    },
    modalCancelText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 13,
        fontWeight: '800',
    },
    modalSubmitGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalSubmitText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '900',
    },
    removeOperatorBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 6,
    },
    // Skeleton Placeholders
    skeletonCard: {
        padding: 24,
        borderRadius: 32,
        marginBottom: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        gap: 12
    },
    skeletonTextTitle: {
        width: 120,
        height: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.08)'
    },
    skeletonTextBalance: {
        width: 180,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginTop: 6
    },
    skeletonTextSub: {
        width: 100,
        height: 14,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginTop: 4
    },
    skeletonMiniCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        gap: 10
    },
    skeletonIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.08)'
    },
    skeletonLineShort: {
        width: '50%',
        height: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.08)'
    },
    skeletonLineMedium: {
        width: '80%',
        height: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.05)'
    },
    skeletonOperatorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        marginBottom: 10,
        gap: 12
    },
    skeletonAvatar: {
        width: 46,
        height: 46,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.08)'
    },
    opCardPremium: {
        padding: 12,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    opRowPremium: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    avatarWrapperPremium: {
        position: 'relative',
    },
    avatarPremium: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    avatarPlaceholderPremium: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    onlineIndicatorPremium: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2.5,
        borderColor: '#09021a',
    },
    detailsColPremium: {
        flex: 1,
        gap: 3,
    },
    detailRowPremium: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailLabelPremium: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.5)',
        fontWeight: '600',
    },
    detailValuePremium: {
        fontSize: 11,
        color: '#ffffff',
        fontWeight: '700',
        textAlign: 'right',
    },
    detailValueDiamondsPremium: {
        fontSize: 11,
        color: '#fbbf24',
        fontWeight: '800',
        textAlign: 'right',
    },
    bottomRowPremium: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    idBadgePremium: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    idBadgeTextPremium: {
        fontSize: 9,
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '700',
    },
    actionBtnPremium: {
        borderRadius: 10,
        overflow: 'hidden',
    },
    actionBtnGradient: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    actionBtnText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '800',
    },
    headerAgencyIdText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 13,
        fontWeight: '700',
        marginTop: 4,
        letterSpacing: 0.5,
    },
    publishersListBtn: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 12,
        elevation: 4,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    publishersListGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    publishersListLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    publishersListRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    publishersListBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '800',
    },
    publisherCountBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    publisherCountBadgeText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
    },
    quickInviteBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 16,
        marginBottom: 20,
    },
    quickInviteContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    quickInviteText: {
        color: '#a855f7',
        fontSize: 12,
        fontWeight: '700',
    },
    publishersModalContainer: {
        flex: 1,
        backgroundColor: '#09021a',
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 15 : 15,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    modalCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    modalHeaderTitleContainer: {
        flex: 1,
    },
    modalHeaderTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    modalHeaderSubtitle: {
        color: '#a855f7',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 2,
    },
    modalAddButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(147, 51, 234, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(147, 51, 234, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginHorizontal: 20,
        marginTop: 15,
        marginBottom: 10,
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 44,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    searchBarInput: {
        flex: 1,
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
        paddingVertical: 0,
    },
    modalScrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 40,
    },
    modalEmptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    modalEmptyText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 15,
        paddingHorizontal: 20,
    },
    modalInviteBtn: {
        marginTop: 20,
        borderRadius: 14,
        overflow: 'hidden',
    },
    modalInviteGradient: {
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    modalInviteBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '800',
    },
    actionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    removeBtnPremium: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(244, 63, 94, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailsBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(5, 2, 15, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    detailsCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 28,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
    },
    detailsHeader: {
        alignItems: 'center',
        marginBottom: 20,
        width: '100%',
    },
    detailsAvatarContainer: {
        position: 'relative',
        marginBottom: 12,
    },
    detailsAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: 'rgba(139, 92, 246, 0.5)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    detailsAvatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: 'rgba(139, 92, 246, 0.5)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailsOnlineDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 3,
        borderColor: '#09021a',
    },
    detailsName: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    detailsIdBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        marginTop: 6,
    },
    detailsIdText: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '700',
    },
    detailsStatsGrid: {
        width: '100%',
        gap: 12,
        marginBottom: 20,
    },
    detailsStatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 12,
        gap: 12,
    },
    detailsStatIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailsStatContent: {
        flex: 1,
    },
    detailsStatLabel: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    detailsStatValue: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '800',
        marginTop: 1,
    },
    detailsWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.2)',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 20,
        width: '100%',
    },
    detailsWarningText: {
        color: '#fbbf24',
        fontSize: 11,
        fontWeight: '700',
    },
    detailsActions: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    detailsBtn: {
        flex: 1,
        height: 46,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailsCloseBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.04)',
    },
    detailsCloseText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 13,
        fontWeight: '800',
    },
    detailsRemoveBtn: {
        backgroundColor: 'rgba(244, 63, 94, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(244, 63, 94, 0.3)',
    },
    detailsRemoveText: {
        color: '#f43f5e',
        fontSize: 13,
        fontWeight: '800',
    }
});
