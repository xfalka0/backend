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
    ActivityIndicator
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
                            <Text style={styles.sectionTitle}>Ajans Yayıncıları ({dashboardData.operators?.length || 0})</Text>
                            <Text style={styles.commissionRateText}>Komisyon Oranı: %{parseFloat(dashboardData.agency?.commission_rate || 0.4) * 100}</Text>
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
                                            <Text style={styles.opName} numberOfLines={1}>{op.display_name || op.username}</Text>
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

                                    </View>
                                </GlassCard>
                            ))
                        )}

                        <View style={{ height: 120 }} />
                    </ScrollView>
                )}
            </SafeAreaView>
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
    }
});
