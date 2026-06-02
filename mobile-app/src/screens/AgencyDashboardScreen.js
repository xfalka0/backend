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
    Alert
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
import { useAppStore } from '../store/useAppStore';

const { width } = Dimensions.get('window');

export default function AgencyDashboardScreen() {
    const navigation = useNavigation();
    const { theme } = useTheme();
    
    // Connect Zustand Store
    const user = useAppStore(state => state.user);

    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState({
        agency: {
            id: '',
            name: 'Yükleniyor...',
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

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            
            {/* Ambient Violet/Pink Backdrop Layer */}
            <LinearGradient
                colors={['#4f46e5', '#9333ea', '#09021a']}
                style={styles.headerBackdrop}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <Ionicons name="business" size={300} color="rgba(255, 255, 255, 0.02)" style={styles.watermark} />
            </LinearGradient>

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
                        <Text style={styles.headerTitle}>{dashboardData.agency?.name || 'Ajans Paneli'}</Text>
                    </View>
                    <View style={styles.statusBadge}>
                        <View style={[styles.statusDot, { backgroundColor: dashboardData.agency?.status === 'active' ? '#10b981' : '#f43f5e' }]} />
                        <Text style={styles.statusText}>{dashboardData.agency?.status === 'active' ? 'Aktif' : 'Pasif'}</Text>
                    </View>
                </View>

                {loading ? (
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color="#9333ea" />
                        <Text style={styles.loaderText}>Ajans verileri yükleniyor...</Text>
                    </View>
                ) : (
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9333ea" />
                        }
                    >
                        {/* Summary Header Card */}
                        <GlassCard intensity={30} tint="dark" style={styles.summaryCard}>
                            <Text style={styles.summaryTitle}>Toplam Bekleyen Hakediş</Text>
                            
                            <View style={styles.balanceContainer}>
                                <Text style={styles.balanceText}>
                                    ₺{(dashboardData.agency?.pending_balance * 0.023).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                                <Text style={styles.usdtText}>
                                    ≈ ${(dashboardData.agency?.pending_balance / 2000).toFixed(2)} USDT
                                </Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.statsRow}>
                                <View style={styles.statBlock}>
                                    <View style={styles.statIconWrapper}>
                                        <Ionicons name="sparkles" size={16} color="#fbbf24" />
                                    </View>
                                    <View>
                                        <Text style={styles.statLabel}>Bugün Kazanılan</Text>
                                        <Text style={styles.statValue}>{dashboardData.stats?.today_diamonds?.toLocaleString()} Elmas</Text>
                                    </View>
                                </View>

                                <View style={styles.statBlock}>
                                    <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                                        <Ionicons name="pulse" size={16} color="#10b981" />
                                    </View>
                                    <View>
                                        <Text style={styles.statLabel}>Aktif Yayıncı</Text>
                                        <Text style={styles.statValue}>{dashboardData.stats?.active_operators} / {dashboardData.stats?.total_operators}</Text>
                                    </View>
                                </View>
                            </View>
                        </GlassCard>

                        {/* Operators Section Header */}
                        <View style={styles.sectionHeader}>
                            <View>
                                <Text style={styles.sectionTitle}>Ajans Yayıncıları ({dashboardData.operators?.length || 0})</Text>
                                <Text style={styles.commissionRateText}>Komisyon Oranı: %{parseFloat(dashboardData.agency?.commission_rate || 0.4) * 100}</Text>
                            </View>
                            <TouchableOpacity 
                                style={styles.inviteButton}
                                activeOpacity={0.8}
                                onPress={() => setIsInviteModalVisible(true)}
                            >
                                <LinearGradient
                                    colors={['#8b5cf6', '#ec4899']}
                                    style={styles.inviteGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Ionicons name="person-add" size={12} color="#fff" style={{ marginRight: 5 }} />
                                    <Text style={styles.inviteButtonText}>Davet Et</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        {/* Operators List */}
                        {dashboardData.operators?.length === 0 ? (
                            <GlassCard intensity={15} tint="dark" style={styles.emptyCard}>
                                <Ionicons name="people-outline" size={40} color="rgba(255, 255, 255, 0.2)" />
                                <Text style={styles.emptyText}>Henüz ajansınıza bağlı bir yayıncı bulunmamaktadır.</Text>
                                <Text style={styles.emptySub}>Yayıncılarınızı davet kodu ile ajansınıza atayabilirsiniz.</Text>
                            </GlassCard>
                        ) : (
                            dashboardData.operators.map((op) => (
                                <GlassCard key={op.id} intensity={20} tint="dark" style={styles.operatorCard}>
                                    <View style={styles.operatorRow}>
                                        
                                        {/* Avatar Container */}
                                        <View style={styles.avatarWrapper}>
                                            <Image 
                                                source={{ uri: op.avatar_url || 'https://via.placeholder.com/150' }} 
                                                style={styles.avatar} 
                                            />
                                            {/* Online Glow Indicator */}
                                            <View style={[styles.onlineIndicator, { backgroundColor: op.is_online ? '#10b981' : '#64748b' }]} />
                                        </View>

                                        {/* Performance Info */}
                                        <View style={styles.opInfo}>
                                            <View style={styles.nameBadgeContainer}>
                                                <Text style={styles.opName} numberOfLines={1}>{op.display_name || op.username}</Text>
                                                {op.is_low_quality && (
                                                    <View style={styles.lowQualityBadge}>
                                                        <Ionicons name="warning" size={10} color="#fbbf24" style={{ marginRight: 3 }} />
                                                        <Text style={styles.lowQualityText}>Düşük Kalite</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View style={styles.metaRow}>
                                                <Text style={styles.opRole}>Yayıncı</Text>
                                                <View style={styles.metaDivider} />
                                                <Ionicons name="star" size={10} color="#fbbf24" style={{ marginRight: 2 }} />
                                                <Text style={styles.opRating}>{parseFloat(op.rating || 5.0).toFixed(1)}</Text>
                                            </View>
                                        </View>

                                        {/* Contributed Commissions */}
                                        <View style={styles.commissionSection}>
                                            <Text style={styles.todayCommissionLabel}>Bugünkü Gelir</Text>
                                            <Text style={styles.todayCommissionValue}>
                                                +{op.today_commission?.toLocaleString()} Elmas
                                            </Text>
                                            <Text style={styles.todayCommissionTl}>
                                                ≈ ₺{(op.today_commission * 0.023).toFixed(2)} TL
                                            </Text>
                                        </View>

                                        {/* Remove Operator Button */}
                                        <TouchableOpacity
                                            style={styles.removeOperatorBtn}
                                            activeOpacity={0.7}
                                            onPress={() => handleRemoveOperator(op.id, op.display_name || op.username)}
                                        >
                                            <Ionicons name="trash-outline" size={15} color="#ef4444" />
                                        </TouchableOpacity>

                                    </View>
                                </GlassCard>
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
    headerBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 280,
        zIndex: 0
    },
    watermark: {
        position: 'absolute',
        top: -50,
        right: -50
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
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginTop: 2
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
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
        marginBottom: 25,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
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
        fontSize: 34,
        fontWeight: '900',
        letterSpacing: -1
    },
    usdtText: {
        color: '#a855f7',
        fontSize: 14,
        fontWeight: '800',
        marginTop: 2
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        marginVertical: 18
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    statBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1
    },
    statIconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    statLabel: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase'
    },
    statValue: {
        color: '#fff',
        fontSize: 12,
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
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.04)',
        marginTop: 10
    },
    emptyText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '800',
        textAlign: 'center',
        marginTop: 15,
        lineHeight: 18
    },
    emptySub: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 6,
        paddingHorizontal: 15
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
    }
});
