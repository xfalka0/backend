import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Dimensions, Platform } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { API_URL } from '../config';
import VipFrame from '../components/ui/VipFrame';
import GlassCard from '../components/ui/GlassCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import AnimatedEmptyState from '../components/ui/AnimatedEmptyState';

const { width } = Dimensions.get('window');

const INITIAL_FAKE_VISITORS = [
    { id: 'fake1', username: 'Buse', avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(), is_blurred: true, vip_level: 0 },
    { id: 'fake2', username: 'Merve', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', created_at: new Date(Date.now() - 1000 * 60 * 38).toISOString(), is_blurred: true, vip_level: 2 },
    { id: 'fake3', username: 'Ece', avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150', created_at: new Date(Date.now() - 1000 * 3600 * 1.5).toISOString(), is_blurred: true, vip_level: 0 },
    { id: 'fake4', username: 'Selin', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', created_at: new Date(Date.now() - 1000 * 3600 * 3).toISOString(), is_blurred: true, vip_level: 3 },
    { id: 'fake5', username: 'Dilan', avatar_url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=150', created_at: new Date(Date.now() - 1000 * 3600 * 6).toISOString(), is_blurred: true, vip_level: 1 },
    { id: 'fake6', username: 'Melisa', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', created_at: new Date(Date.now() - 1000 * 3600 * 12).toISOString(), is_blurred: true, vip_level: 0 },
    { id: 'fake7', username: 'Hilal', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', created_at: new Date(Date.now() - 1000 * 3600 * 18).toISOString(), is_blurred: true, vip_level: 4 },
];

export default function ProfileVisitorsScreen({ navigation, route }) {
    const { theme } = useTheme();
    const { user } = route.params || {};
    
    const [activeTab, setActiveTab] = useState('whoViewedMe'); // 'whoViewedMe' or 'whoIVisited'
    const [visitors, setVisitors] = useState(INITIAL_FAKE_VISITORS);
    const [history, setHistory] = useState([]);
    const [isVIP, setIsVIP] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(user || null);

    useEffect(() => {
        const loadUserAndFetch = async () => {
            setLoading(true);
            let activeUser = user;
            if (!activeUser?.id) {
                try {
                    const storedUser = await AsyncStorage.getItem('user');
                    if (storedUser) {
                        activeUser = JSON.parse(storedUser);
                        setCurrentUser(activeUser);
                    }
                } catch (e) {
                    console.error('Load user error:', e);
                }
            }
            if (activeUser?.id) {
                await fetchData(activeUser.id, activeUser.vip_level);
            } else {
                setLoading(false);
            }
        };
        loadUserAndFetch();
    }, [user, activeTab]);

    const fetchData = async (userIdVal, userVipLevelVal) => {
        const targetUserId = userIdVal || currentUser?.id;
        if (!targetUserId) {
            setLoading(false);
            return;
        }
        try {
            const token = await AsyncStorage.getItem('token');
            if (activeTab === 'whoViewedMe') {
                const res = await axios.get(`${API_URL}/views/${targetUserId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setIsVIP(res.data.isVIP);
                let fetchedVisitors = res.data.visitors || [];
                const userVipLevel = userVipLevelVal !== undefined ? userVipLevelVal : parseInt(currentUser?.vip_level || 0, 10);
                const isUserVIP = res.data.isVIP || userVipLevel >= 4;
                
                if (fetchedVisitors.length === 0) {
                    fetchedVisitors = [
                        { id: 'fake1', username: 'Buse', avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(), is_blurred: !isUserVIP, vip_level: 0 },
                        { id: 'fake2', username: 'Merve', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', created_at: new Date(Date.now() - 1000 * 60 * 38).toISOString(), is_blurred: !isUserVIP, vip_level: 2 },
                        { id: 'fake3', username: 'Ece', avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150', created_at: new Date(Date.now() - 1000 * 3600 * 1.5).toISOString(), is_blurred: !isUserVIP, vip_level: 0 },
                        { id: 'fake4', username: 'Selin', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', created_at: new Date(Date.now() - 1000 * 3600 * 3).toISOString(), is_blurred: !isUserVIP, vip_level: 3 },
                        { id: 'fake5', username: 'Dilan', avatar_url: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=150', created_at: new Date(Date.now() - 1000 * 3600 * 6).toISOString(), is_blurred: !isUserVIP, vip_level: 1 },
                        { id: 'fake6', username: 'Melisa', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', created_at: new Date(Date.now() - 1000 * 3600 * 12).toISOString(), is_blurred: !isUserVIP, vip_level: 0 },
                        { id: 'fake7', username: 'Hilal', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', created_at: new Date(Date.now() - 1000 * 3600 * 18).toISOString(), is_blurred: !isUserVIP, vip_level: 4 },
                    ];
                }
                setVisitors(fetchedVisitors);
            } else {
                const res = await axios.get(`${API_URL}/views/history/${targetUserId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setHistory(res.data.history || []);
            }
        } catch (error) {
            console.error('Fetch Visitors/History Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTimestamp = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Az önce';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} dakika önce`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} saat önce`;
        return `${Math.floor(diffInSeconds / 86400)} gün önce`;
    };

    const cleanUsername = (name) => {
        if (!name) return '';
        let cleaned = name.replace(/^op_/i, '');
        cleaned = cleaned.replace(/_\d+(-\d+)?$/g, '');
        if (name.toLowerCase().startsWith('op_') && cleaned.length > 0) {
            cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        }
        return cleaned;
    };

    const renderVisitorItem = ({ item, index }) => {
    const isWhoViewed = activeTab === 'whoViewedMe';
    const displayBlurred = isWhoViewed && item.is_blurred;
    
    const displayName = displayBlurred ? '*********' : cleanUsername(item.username);
    const subText = displayBlurred ? 'Bugün Profilinizi Görüntüleyenler' : (isWhoViewed ? 'Profilinizi ziyaret etti' : 'Profilini ziyaret ettiniz');

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 40).springify().damping(13)}
            layout={Layout.springify()}
        >
            <TouchableOpacity
                onPress={() => {
                    if (isWhoViewed && item.is_blurred) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        navigation.navigate('VipDetails', { user: currentUser });
                        return;
                    }
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const operatorData = {
                            id: item.id,
                            user_id: item.id,
                            name: item.username,
                            avatar_url: item.avatar_url,
                            gender: item.gender,
                            vip_level: item.vip_level || 0,
                            is_online: item.is_online
                        };
                        navigation.navigate('OperatorProfile', { operator: operatorData, user });
                    }}
                    style={styles.cardContainer}
                    activeOpacity={0.8}
                >
                    <GlassCard intensity={25} tint="dark" style={styles.visitorCard}>
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatarWrapper}>
                                <VipFrame
                                    level={item.vip_level || 0}
                                    avatar={displayBlurred ? null : (item.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username || 'User')}&background=random&color=fff`)}
                                    size={50}
                                    isStatic={true}
                                />
                            </View>
                            {item.is_online && !displayBlurred && (
                                <View style={styles.onlineBadge} />
                            )}
                        </View>

                        <View style={styles.content}>
                            <Text style={styles.name} numberOfLines={1}>
                                {displayName}
                            </Text>
                            <Text style={styles.subText} numberOfLines={1}>
                                {subText}
                            </Text>
                            <Text style={styles.timeText}>
                                {formatTimestamp(item.created_at)}
                            </Text>
                        </View>

                        {isWhoViewed && !isVIP ? (
                            <View style={styles.lockBadge}>
                                <Ionicons name="lock-closed" size={15} color="#FFB300" />
                            </View>
                        ) : (
                            <View style={styles.eyeIconBox}>
                                <Ionicons name="chevron-forward" size={16} color="rgba(255, 255, 255, 0.4)" />
                            </View>
                        )}
                    </GlassCard>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const currentList = activeTab === 'whoViewedMe' ? visitors : history;

    return (
        <View style={styles.container}>
            {/* Background Image Layer identical to Profile Screen */}
            <View style={styles.bgWrapper}>
                <Image 
                    source={require('../../assets/fiva_profile_banner.png')} 
                    style={styles.backgroundImage}
                />
                <LinearGradient
                    colors={['rgba(9, 2, 26, 0.15)', 'rgba(9, 2, 26, 0.8)', '#09021a']}
                    style={StyleSheet.absoluteFill}
                />
            </View>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ziyaretçi Kullanıcı</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Premium Sliding Segmented Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'whoViewedMe' && styles.activeTabButton]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setActiveTab('whoViewedMe');
                    }}
                    activeOpacity={0.7}
                >
                    <Text style={[
                        styles.tabText,
                        activeTab === 'whoViewedMe' ? styles.activeTabText : styles.inactiveTabText
                    ]}>
                        Beni kim gördü
                    </Text>
                    {activeTab === 'whoViewedMe' && (
                        <LinearGradient
                            colors={['#EC4899', '#7C3AED']}
                            style={styles.activeTabIndicator}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        />
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'whoIVisited' && styles.activeTabButton]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setActiveTab('whoIVisited');
                    }}
                    activeOpacity={0.7}
                >
                    <Text style={[
                        styles.tabText,
                        activeTab === 'whoIVisited' ? styles.activeTabText : styles.inactiveTabText
                    ]}>
                        Kimi Ziyaret Ettim
                    </Text>
                    {activeTab === 'whoIVisited' && (
                        <LinearGradient
                            colors={['#EC4899', '#7C3AED']}
                            style={styles.activeTabIndicator}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        />
                    )}
                </TouchableOpacity>
            </View>
            <View style={styles.tabDivider} />

            {loading && visitors.length === 0 ? (
                <View style={{ padding: 16 }}>
                    {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
                </View>
            ) : currentList.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <AnimatedEmptyState
                        icon="eye-off-outline"
                        title={activeTab === 'whoViewedMe' ? "Hâlâ Sakin" : "Ziyaret Yok"}
                        description={activeTab === 'whoViewedMe' 
                            ? "Görünüşe göre henüz profilini kimse ziyaret etmemiş. Daha aktif ol!"
                            : "Henüz kimsenin profilini ziyaret etmediniz. Keşfet sayfasından yeni insanlarla tanışın!"}
                        colors={['#3B82F6', '#8B5CF6']}
                    />
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <FlatList
                        data={currentList}
                        renderItem={renderVisitorItem}
                        keyExtractor={(item, idx) => (item.id || idx).toString() + '-' + item.created_at}
                        contentContainerStyle={{ 
                            paddingVertical: 12, 
                            paddingBottom: (visitors.some(v => v.is_blurred) && activeTab === 'whoViewedMe') ? 140 : 50 
                        }}
                        showsVerticalScrollIndicator={false}
                    />

                    {/* Gold Premium Paywall Action Button at the Bottom */}
                    {visitors.some(v => v.is_blurred) && activeTab === 'whoViewedMe' && (
                        <View style={styles.paywallOverlay}>
                            <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />
                            <LinearGradient
                                colors={['rgba(9, 2, 26, 0.0)', 'rgba(9, 2, 26, 0.85)', '#09021a']}
                                style={StyleSheet.absoluteFillObject}
                            />
                            
                            <TouchableOpacity
                                style={styles.paywallBtn}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    navigation.navigate('VipDetails', { user });
                                }}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#FFE082', '#FFB300']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.paywallGradient}
                                >
                                    <Text style={styles.paywallBtnText}>
                                        VIP Yükselt & Ziyaretçileri Gör ⚡
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09021a',
    },
    bgWrapper: {
        position: 'absolute',
        width: '100%',
        height: 400,
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 15,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 10,
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        position: 'relative',
    },
    activeTabButton: {},
    tabText: {
        fontSize: 14,
        letterSpacing: -0.2,
    },
    activeTabText: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    inactiveTabText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontWeight: '600',
    },
    activeTabIndicator: {
        position: 'absolute',
        bottom: 0,
        width: 48,
        height: 3,
        borderRadius: 1.5,
    },
    tabDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginHorizontal: 20,
        marginBottom: 10,
    },
    cardContainer: {
        marginBottom: 10,
        marginHorizontal: 16,
    },
    visitorCard: {
        flexDirection: 'row',
        padding: 10,
        borderRadius: 16,
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
    },
    avatarWrapper: {
        width: 50,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
    },
    onlineBadge: {
        position: 'absolute',
        bottom: 1,
        right: 1,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#10b981',
        borderWidth: 2,
        borderColor: '#110C24',
        zIndex: 2,
    },
    content: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    name: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    subText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 11,
        marginTop: 2,
    },
    timeText: {
        color: 'rgba(255, 255, 255, 0.3)',
        fontSize: 9.5,
        marginTop: 2,
    },
    lockBadge: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 179, 0, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 179, 0, 0.15)',
    },
    eyeIconBox: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    paywallOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    paywallBtn: {
        width: '100%',
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#FFB300',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    paywallGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    paywallBtnText: {
        color: '#09021a',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
});
