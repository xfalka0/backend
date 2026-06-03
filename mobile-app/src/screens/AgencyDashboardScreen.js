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

const { width } = Dimensions.get('window');

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
    const [inviteIdentifier, setInviteIdentifier] = useState('');
    const [inviting, setInviting] = useState(false);
    const [isPublishersModalVisible, setIsPublishersModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Pulse animation for skeleton loading state
    const [pulseAnim] = useState(new Animated.Value(0.3));

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

    const fetchDashboardData = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const res = await axios.get(`${API_URL}/agency/my-dashboard`, {
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
        fetchDashboardData();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await fetchDashboardData();
        setRefreshing(false);
    };

    const filteredOperators = (dashboardData.operators || []).filter(op => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        const name = (op.display_name || op.username || '').toLowerCase();
        const shortId = String(op.id).slice(-9).toUpperCase().toLowerCase();
        const fullId = String(op.id).toLowerCase();
        return name.includes(query) || shortId.includes(query) || fullId.includes(query);
    });
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
                                    ₺{(dashboardData.agency?.pending_balance * 0.023).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                                <Text style={styles.usdtText}>
                                    ≈ ${(dashboardData.agency?.pending_balance / 2000).toFixed(2)} USDT
                                </Text>
                            </View>
                        </GlassCard>

                        {/* Stats Grid Layout */}
                        <View style={styles.statsGrid}>
                            <GlassCard 
                                intensity={25} 
                                tint="dark" 
                                style={styles.miniStatCard}
                                colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.01)']}
                            >
                                <View style={styles.statIconWrapper}>
                                    <Ionicons name="sparkles" size={16} color="#fbbf24" />
                                </View>
                                <View style={styles.statInfo}>
                                    <Text style={styles.statLabel}>Bugün Kazanılan</Text>
                                    <Text style={styles.statValue}>{dashboardData.stats?.today_diamonds?.toLocaleString()} Elmas</Text>
                                </View>
                            </GlassCard>

                            <GlassCard 
                                intensity={25} 
                                tint="dark" 
                                style={styles.miniStatCard}
                                colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.01)']}
                            >
                                <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                                    <Ionicons name="pulse" size={16} color="#10b981" />
                                </View>
                                <View style={styles.statInfo}>
                                    <Text style={styles.statLabel}>Aktif Yayıncı</Text>
                                    <Text style={styles.statValue}>{dashboardData.stats?.active_operators} / {dashboardData.stats?.total_operators}</Text>
                                </View>
                            </GlassCard>
                        </View>

                        {/* Yayıncılar Listesi Butonu */}
                        <TouchableOpacity
                            style={styles.publishersListBtn}
                            activeOpacity={0.8}
                            onPress={() => setIsPublishersModalVisible(true)}
                        >
                            <LinearGradient
                                colors={['#8b5cf6', '#ec4899']}
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

            {/* Publishers List Modal */}
            <Modal
                visible={isPublishersModalVisible}
                animationType="slide"
                onRequestClose={() => setIsPublishersModalVisible(false)}
            >
                <View style={styles.publishersModalContainer}>
                    <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
                    
                    {/* Header Row */}
                    <View style={styles.modalHeaderRow}>
                        <TouchableOpacity 
                            style={styles.modalCloseButton}
                            onPress={() => setIsPublishersModalVisible(false)}
                        >
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.modalHeaderTitleContainer}>
                            <Text style={styles.modalHeaderTitle}>YAYINCILAR LİSTESİ</Text>
                            <Text style={styles.modalHeaderSubtitle}>
                                Komisyon Oranı: %{parseFloat(dashboardData.agency?.commission_rate || 0.4) * 100}
                            </Text>
                        </View>
                        <TouchableOpacity 
                            style={styles.modalAddButton}
                            onPress={() => {
                                setIsInviteModalVisible(true);
                            }}
                        >
                            <Ionicons name="person-add" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Search Bar */}
                    <View style={styles.searchBarContainer}>
                        <Ionicons name="search" size={18} color="rgba(255, 255, 255, 0.4)" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.searchBarInput}
                            placeholder="Yayıncı adı veya ID ile ara..."
                            placeholderTextColor="rgba(255, 255, 255, 0.4)"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={18} color="rgba(255, 255, 255, 0.4)" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* List Content */}
                    <ScrollView 
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.modalScrollContent}
                    >
                        {filteredOperators.length === 0 ? (
                            <View style={styles.modalEmptyState}>
                                <Ionicons name="people-outline" size={64} color="rgba(255, 255, 255, 0.15)" />
                                <Text style={styles.modalEmptyText}>
                                    {searchQuery ? 'Arama sonucu yayıncı bulunamadı.' : 'Henüz ajansınıza bağlı bir yayıncı bulunmamaktadır.'}
                                </Text>
                                {!searchQuery && (
                                    <TouchableOpacity
                                        style={styles.modalInviteBtn}
                                        activeOpacity={0.8}
                                        onPress={() => setIsInviteModalVisible(true)}
                                    >
                                        <LinearGradient
                                            colors={['#8b5cf6', '#ec4899']}
                                            style={styles.modalInviteGradient}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                        >
                                            <Text style={styles.modalInviteBtnText}>Yayıncı Davet Et</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            filteredOperators.map((op) => {
                                const shortId = String(op.id).slice(-9).toUpperCase();
                                return (
                                    <View key={op.id} style={styles.opCardNew}>
                                        <View style={styles.opRowNew}>
                                            {/* Avatar Left */}
                                            <View style={styles.avatarWrapperNew}>
                                                <Image 
                                                    source={{ uri: op.avatar_url || 'https://via.placeholder.com/150' }} 
                                                    style={styles.avatarNew} 
                                                />
                                                <View style={[styles.onlineIndicatorNew, { backgroundColor: op.is_online ? '#10b981' : '#64748b' }]} />
                                            </View>

                                            {/* Details Right */}
                                            <View style={styles.detailsColNew}>
                                                <View style={styles.detailRowNew}>
                                                    <Text style={styles.detailLabelNew}>Ad :</Text>
                                                    <Text style={styles.detailValueNew}>{op.display_name || op.username}</Text>
                                                </View>
                                                <View style={styles.detailRowNew}>
                                                    <Text style={styles.detailLabelNew}>Gelir :</Text>
                                                    <Text style={styles.detailValueNew}>{op.today_commission || 0}</Text>
                                                </View>
                                                <View style={styles.detailRowNew}>
                                                    <Text style={styles.detailLabelNew}>Etkili zaman :</Text>
                                                    <Text style={styles.detailValueNew}>00:00:00</Text>
                                                </View>
                                                <View style={styles.detailRowNew}>
                                                    <Text style={styles.detailLabelNew}>Etkili gün :</Text>
                                                    <Text style={styles.detailValueNew}>0</Text>
                                                </View>

                                                {/* Bottom Action Row */}
                                                <View style={styles.bottomRowNew}>
                                                    <View style={styles.idBadgeNew}>
                                                        <Text style={styles.idBadgeTextNew}>ID:{shortId}</Text>
                                                    </View>
                                                    <TouchableOpacity 
                                                        style={styles.detailsBtnNew}
                                                        activeOpacity={0.8}
                                                        onPress={() => {
                                                            Alert.alert(
                                                                'Yayıncı Detayları',
                                                                `Adı: ${op.display_name || op.username}\nID: ${op.id}\nBugünkü Gelir: ${op.today_commission || 0} Elmas\nRating: ${parseFloat(op.rating || 5.0).toFixed(1)}\nDurum: ${op.is_online ? 'Çevrimiçi' : 'Çevrimdışı'}${op.is_low_quality ? '\n\n⚠️ Uyarı: Yayıncı kalitesi düşük!' : ''}`,
                                                                [
                                                                    { text: 'Kapat', style: 'cancel' },
                                                                    { 
                                                                        text: 'Ajans Dışı Bırak (Çıkar)', 
                                                                        style: 'destructive',
                                                                        onPress: () => {
                                                                            handleRemoveOperator(op.id, op.display_name || op.username);
                                                                        }
                                                                    }
                                                                ]
                                                            );
                                                        }}
                                                    >
                                                        <Text style={styles.detailsBtnTextNew}>Detaylar</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09021a'
    },
    safeArea: {
        flex: 1
    },
    bgWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 380,
        zIndex: 0,
        overflow: 'hidden'
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
        paddingVertical: 15,
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
        fontSize: 24, // Devasa ajans adı puntoları
        fontWeight: '950',
        letterSpacing: -0.5,
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
        padding: 24,
        borderRadius: 32,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)' // Parlayan cam sınırları
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
        fontSize: 36, // Daha parıltılı ve devasa
        fontWeight: '950',
        letterSpacing: -1,
        textShadowColor: 'rgba(255, 255, 255, 0.25)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 12,
    },
    usdtText: {
        color: '#38bdf8', // Neon elektrik mavisi/cyan
        fontSize: 14,
        fontWeight: '800',
        marginTop: 2,
        textShadowColor: 'rgba(56, 189, 248, 0.3)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 6,
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
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        gap: 10,
    },
    statIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 12,
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
        fontSize: 12,
        fontWeight: '900',
        marginTop: 2
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
    opCardNew: {
        backgroundColor: '#eaeaea',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        marginHorizontal: 4,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    opRowNew: {
        flexDirection: 'row',
        gap: 16,
        alignItems: 'flex-start',
    },
    avatarWrapperNew: {
        position: 'relative',
        marginTop: 4,
    },
    avatarNew: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 2,
        borderColor: '#fff',
    },
    onlineIndicatorNew: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#eaeaea',
    },
    detailsColNew: {
        flex: 1,
        gap: 4,
    },
    detailRowNew: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 1,
    },
    detailLabelNew: {
        fontSize: 14,
        color: '#555555',
        fontWeight: '500',
    },
    detailValueNew: {
        fontSize: 14,
        color: '#1f2937',
        fontWeight: '600',
        textAlign: 'right',
    },
    bottomRowNew: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    idBadgeNew: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#dddddd',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    idBadgeTextNew: {
        fontSize: 11,
        color: '#666666',
        fontWeight: '700',
    },
    detailsBtnNew: {
        backgroundColor: '#000000',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 6,
    },
    detailsBtnTextNew: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
    }
});
