import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Dimensions, ScrollView, Alert, TextInput, Modal, Pressable, ActivityIndicator, Linking, Platform, StatusBar } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL, SOCKET_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import VipFrame from '../components/ui/VipFrame';
import VipBadge from '../components/ui/VipBadge';
import HiButton from '../components/ui/HiButton';
import StoryRing from '../components/animated/StoryRing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassCard from '../components/ui/GlassCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import DestinyHero from '../components/DestinyHero';
import { resolveImageUrl } from '../utils/imageUtils';
import { maskContactInfo } from '../utils/textUtils';
import GradientText from '../components/ui/GradientText';
import ActionCards from '../components/ui/ActionCards';
import FilterModal from '../components/ui/FilterModal';

const { width } = Dimensions.get('window');
let lastProfileTap = 0;

const normalizeText = (value = '') => {
    if (!value) return '';
    let text = value.toString();
    text = text.replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/ı/g, 'i').replace(/Ş/g, 's').replace(/ş/g, 's')
               .replace(/Ğ/g, 'g').replace(/ğ/g, 'g').replace(/Ü/g, 'u').replace(/ü/g, 'u')
               .replace(/Ö/g, 'o').replace(/ö/g, 'o').replace(/Ç/g, 'c').replace(/ç/g, 'c');
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
};

const getProfileGender = (profile) => {
    if (!profile) return 'kadin';
    let raw = (profile.gender || '').toString().trim().toLowerCase();
    raw = raw.replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
    if (raw === 'coin_bayisi' || raw.includes('bayi')) return 'coin_bayisi';
    if (raw === 'erkek' || raw.includes('erkek') || raw.includes('male') || raw === 'man') return 'erkek';
    return 'kadin';
};

const OperatorItem = React.memo(({ item, navigation, user, theme, onHiPress }) => {
    console.log('[DEBUG OPERATOR ITEM]', item.name, 'avatar:', item.avatar_url, 'photos:', item.photos);
    const profileGender = getProfileGender(item);
    const handleLocalHiPress = React.useCallback(() => {
        if (onHiPress) onHiPress(item);
    }, [onHiPress, item]);

    return (
        <GlassCard style={styles.userCard} intensity={40}>
            <View style={styles.cardHeader}>
                <TouchableOpacity
                    style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}
                    onPress={() => navigation.navigate('OperatorProfile', { operator: item, user })}
                >
                    <View style={styles.avatarContainer}>
                        <StoryRing hasNewStory={!!item.has_active_story} size={69}>
                            <VipFrame level={profileGender === 'coin_bayisi' ? 'dealer' : (item.vip_level || 0)} avatar={item.avatar_url} size={65} isStatic={true} />
                        </StoryRing>
                        {item.is_online && <View style={styles.onlineBadge} />}
                    </View>
                    <View style={styles.infoContainer}>
                        <View style={styles.nameRow}>
                            <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>
                            <VipBadge level={item.vip_level} style={{ marginLeft: 2 }} />
                            <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
                        </View>
                        <View style={styles.chipsRow}>
                            <View style={styles.infoChip}>
                                <Ionicons name="location-sharp" size={10} color="#a855f7" style={{ marginRight: 2 }} />
                                <Text style={[styles.infoChipText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                                    {item.distance_km ? `${item.distance_km.toFixed(1)} km` : (item.city || 'İstanbul')}
                                </Text>
                            </View>

                            <Text style={styles.chipDivider}>·</Text>

                            <View style={styles.infoChip}>
                                <Ionicons name={profileGender === 'erkek' ? "male" : "female"} size={10} color={profileGender === 'erkek' ? '#3b82f6' : '#ec4899'} style={{ marginRight: 2 }} />
                                <Text style={[styles.infoChipText, { color: theme.colors.textSecondary }]}>{item.age ? `${item.age}y` : '25y'}</Text>
                            </View>

                            <Text style={styles.chipDivider}>·</Text>

                            <View style={[styles.infoChip, { maxWidth: 95 }]}>
                                <Ionicons name="briefcase" size={10} color="#3b82f6" style={{ marginRight: 2 }} />
                                <Text style={[styles.infoChipText, { color: theme.colors.textSecondary }]} numberOfLines={1}>{item.job || 'Serbest'}</Text>
                            </View>

                            <Text style={styles.chipDivider}>·</Text>

                            <View style={styles.infoChip}>
                                <Ionicons name="man" size={10} color="#06b6d4" style={{ marginRight: 2 }} />
                                <Text style={[styles.infoChipText, { color: theme.colors.textSecondary }]}>{item.boy ? `${item.boy} cm` : '172 cm'}</Text>
                            </View>

                            {item.is_verified ? (
                                <>
                                    <Text style={styles.chipDivider}>·</Text>
                                    <View style={styles.infoChip}>
                                        <Ionicons name="checkmark-circle" size={10} color="#3b82f6" style={{ marginRight: 2 }} />
                                        <Text style={[styles.infoChipText, { color: theme.colors.textSecondary }]}>Doğrulandı</Text>
                                    </View>
                                </>
                            ) : null}
                        </View>
                    </View>
                </TouchableOpacity>
                <View style={{ transform: [{ scale: 0.9 }] }}>
                    <HiButton
                        operatorId={item.id}
                        onPress={() => navigation.navigate('Chat', { operatorId: item.id, name: item.name, gender: item.gender, avatar_url: item.avatar_url, vip_level: item.vip_level || 0, user })}
                        onHiPress={handleLocalHiPress}
                    />
                </View>
            </View>
            {item.bio && <Text style={[styles.bioText, { color: theme.colors.textSecondary }]} numberOfLines={2}>{maskContactInfo(item.bio)}</Text>}
            
            {item.photos && item.photos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumScroll}>
                    {item.photos.map((p, i) => (
                        <Image 
                            key={i} 
                            source={{ uri: resolveImageUrl(p) }} 
                            onError={(e) => console.log(`[DEBUG ListAlbumPhoto Error] User: ${item.name}, Index: ${i}, URI: ${resolveImageUrl(p)}, Error:`, e.nativeEvent.error)}
                            onLoad={() => console.log(`[DEBUG ListAlbumPhoto Success] User: ${item.name}, Index: ${i}, URI: ${resolveImageUrl(p)} loaded successfully`)}
                            style={styles.albumImage} 
                        />
                    ))}
                </ScrollView>
            )}
        </GlassCard>
    );
});

import PremiumCoinCard from '../components/hero/PremiumCoinCard';
import PromotedProfiles from '../components/home/PromotedProfiles';

export default function HomeScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();
    const { user: routeUser } = route.params || {};
    const user = routeUser || { id: 'guest', name: 'Misafir', balance: 0 };
    
    const [operators, setOperators] = useState([]);
    const [featuredOperators, setFeaturedOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState(user.balance || 0);
    const [activeTab, setActiveTab] = useState('Önerilen');
    const [searchText, setSearchText] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [currentFilters, setCurrentFilters] = useState({ gender: 'all', ageGroup: 'all' });
    const [showFilterModal, setShowFilterModal] = useState(false);

    // Pagination states
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        fetchOperators(1);
    }, [activeTab]);

    const fetchOperators = async (pageNum = 1, isRefreshing = false) => {
        if (isRefreshing) {
            setRefreshing(true);
        } else if (pageNum === 1) {
            setLoading(true);
            setOperators([]); // Clear list immediately on tab change to show loading skeleton
        } else {
            setLoadingMore(true);
        }

        const requestedTab = activeTab; // Keep track of tab for race conditions

        try {
            const token = await AsyncStorage.getItem('token');
            // Fetch 20 profiles per page to fill the screen and support smooth scrolling
            const res = await axios.get(`${API_URL}/discovery?tab=${requestedTab}&page=${pageNum}&limit=20`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // If the user has switched tabs while this request was loading, discard the stale result
            if (activeTab !== requestedTab) {
                return;
            }

            const data = res.data?.data || res.data || [];
            console.log('[DEBUG FETCH OPERATORS] Loaded length:', data.length, 'data names:', data.map(op => op.name));
            
            if (pageNum === 1) {
                setOperators(data);
                // Extract boosted/featured operators for the horizontal list
                const featured = data.filter(op => op.is_boosted || op.vip_level > 0).slice(0, 15);
                setFeaturedOperators(featured);
                setPage(1);
                setHasMore(data.length >= 20);
            } else {
                if (data.length > 0) {
                    setOperators(prev => {
                        const existingIds = new Set(prev.map(item => item.id));
                        const uniqueNewData = data.filter(item => !existingIds.has(item.id));
                        return [...prev, ...uniqueNewData];
                    });
                    setPage(pageNum);
                    setHasMore(data.length >= 20);
                } else {
                    setHasMore(false);
                }
            }
        } catch (e) {
            console.error('Fetch operators error:', e);
        } finally {
            // Only toggle loading states if we are still on the active tab
            if (activeTab === requestedTab) {
                setLoading(false);
                setRefreshing(false);
                setLoadingMore(false);
            }
        }
    };

    const onRefresh = () => {
        fetchOperators(1, true);
    };

    const handleLoadMore = () => {
        if (loading || loadingMore || !hasMore) return;
        fetchOperators(page + 1);
    };

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#ec4899" />
            </View>
        );
    };

    const handleHiPress = React.useCallback(async (operator) => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/messages/send-hi`, {
                senderId: user.id,
                receiverId: operator.id,
                content: 'Merhaba'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                // Update local balance state and storage
                if (res.data.newBalance !== undefined) {
                    setBalance(res.data.newBalance);
                    const updatedUser = { ...user, balance: res.data.newBalance };
                    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
                }
            }
        } catch (error) {
            console.error('Hi send error:', error);
            if (error.response?.data?.insufficientFunds) {
                navigation.navigate('PurchaseInfo', { user });
            }
        }
    }, [user, navigation]);

    // Use useMemo for the header to prevent unnecessary re-renders of the entire list
    const headerComponent = React.useMemo(() => (
        <View style={styles.header}>
            {showSearch && (
                <View style={[styles.searchWrapper, { backgroundColor: theme.colors.glass }]}>
                    <Ionicons name="search" size={18} color={theme.colors.textSecondary} style={{ marginRight: 10 }} />
                    <TextInput
                        style={[styles.searchInput, { color: theme.colors.text }]}
                        placeholder="İsim veya meslek ara..."
                        placeholderTextColor={theme.colors.textSecondary}
                        value={searchText}
                        onChangeText={setSearchText}
                        autoFocus
                    />
                </View>
            )}

            <PremiumCoinCard 
                onCoinPress={() => navigation.navigate('PurchaseInfo', { user })}
                onExplorePress={() => navigation.navigate('Keşfet')}
                onResellerPress={() => navigation.navigate('PurchaseInfo', { user, reseller: true })}
            />
            <ActionCards 
                onRewardsPress={() => navigation.navigate('Leaderboard')} 
                onInvitePress={() => navigation.navigate('Invite')} 
                theme={theme}
            />

            <View style={{ paddingHorizontal: 16 }}>
                <DestinyHero onPress={() => navigation.navigate('Keşfet')} />
            </View>

            <TouchableOpacity 
                activeOpacity={0.85} 
                style={styles.partyBannerWrapper}
                onPress={() => navigation.navigate('PartyRoomsList')}
            >
                <LinearGradient
                    colors={['#8b5cf6', '#ec4899']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.partyBanner}
                >
                    <View style={styles.partyBannerLeft}>
                        <View style={styles.partyIconCircle}>
                            <Ionicons name="mic" size={22} color="#fff" />
                        </View>
                        <View style={styles.partyTextContainer}>
                            <Text style={styles.partyTitle}>Sesli Sohbet Odaları 🎙️</Text>
                            <Text style={styles.partySubtitle}>Ses partilerine katıl veya kendi odanı kur!</Text>
                        </View>
                    </View>
                    <View style={styles.partyBadge}>
                        <Text style={styles.partyBadgeText}>Canlı</Text>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
            
            <View style={[styles.tabContainer, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    {['Önerilen', 'Çevrimiçi', 'Yeni', 'Popüler'].map(tab => {
                        const isActive = activeTab === tab;
                        return (
                            <TouchableOpacity 
                                key={tab} 
                                onPress={() => setActiveTab(tab)} 
                                style={styles.tab}
                                activeOpacity={0.75}
                            >
                                {isActive ? (
                                    <GradientText
                                        colors={['#a855f7', '#ec4899']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={[styles.tabText, styles.activeTabText]}
                                    >
                                        {tab}
                                    </GradientText>
                                ) : (
                                    <Text style={[
                                        styles.tabText, 
                                        styles.inactiveTabText,
                                        { 
                                            color: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : '#64748B' 
                                        }
                                    ]}>
                                        {tab}
                                    </Text>
                                )}
                                {isActive && (
                                    <LinearGradient
                                        colors={['#a855f7', '#ec4899']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.tabIndicator}
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <TouchableOpacity 
                    onPress={() => setShowFilterModal(true)}
                    style={{ padding: 4 }}
                >
                    <Ionicons 
                        name="options-outline" 
                        size={24} 
                        color={(currentFilters.gender !== 'all' || currentFilters.ageGroup !== 'all') ? '#ec4899' : (theme.mode === 'dark' ? '#fff' : '#0f172a')} 
                    />
                </TouchableOpacity>
            </View>
        </View>
    ), [theme, balance, showSearch, searchText, activeTab, user, featuredOperators, currentFilters]);


    const filteredData = React.useMemo(() => {
        const resList = operators.filter(op => {
            const matchesSearch = normalizeText(op.name).includes(normalizeText(searchText)) ||
                                  normalizeText(op.job || '').includes(normalizeText(searchText));
            
            let matchesGender = true;
            if (currentFilters.gender !== 'all') {
                const opGender = getProfileGender(op);
                matchesGender = opGender === currentFilters.gender;
            }

            let matchesAge = true;
            if (currentFilters.ageGroup !== 'all' && op.age) {
                const age = parseInt(op.age, 10);
                if (currentFilters.ageGroup === '18-24') matchesAge = age >= 18 && age <= 24;
                else if (currentFilters.ageGroup === '25-34') matchesAge = age >= 25 && age <= 34;
                else if (currentFilters.ageGroup === '35-44') matchesAge = age >= 35 && age <= 44;
                else if (currentFilters.ageGroup === '45+') matchesAge = age >= 45;
            }

            return matchesSearch && matchesGender && matchesAge;
        });
        console.log('[DEBUG FILTERED DATA] Length:', resList.length, 'names:', resList.map(op => op.name));
        return resList;
    }, [operators, searchText, currentFilters]);

    const renderItem = React.useCallback(({ item }) => (
        <OperatorItem 
            item={item} 
            navigation={navigation} 
            user={user} 
            theme={theme} 
            onHiPress={handleHiPress}
        />
    ), [navigation, user, theme, handleHiPress]);

    return (
        <LinearGradient
            colors={theme.mode === 'dark' ? theme.gradients.dark : [theme.colors.background, theme.colors.backgroundSecondary]}
            style={styles.container}
        >
            <View style={{ height: Platform.OS === 'ios' ? insets.top : (StatusBar.currentHeight || 24) - 4 }} />
            <FlatList
                data={filteredData}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                ListHeaderComponent={headerComponent}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={loading ? (
                    <View style={{ padding: 20 }}>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </View>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="search-outline" size={48} color={theme.colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                            Sonuç bulunamadı.
                        </Text>
                    </View>
                )}
                contentContainerStyle={{ paddingBottom: 120 }}
                onRefresh={onRefresh}
                refreshing={refreshing}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.4}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={false}
                maxToRenderPerBatch={10}
                windowSize={5}
            />

            <FilterModal 
                visible={showFilterModal} 
                onClose={() => setShowFilterModal(false)} 
                onApply={(filters) => setCurrentFilters(filters)} 
                currentFilters={currentFilters}
                theme={theme}
            />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 0, paddingBottom: 5 },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 16 },
    logo: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
    subLogo: { fontSize: 12, fontWeight: '500', marginTop: -5, opacity: 0.8 },
    iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 0 },
    smallIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    balanceBadge: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingLeft: 4, 
        paddingRight: 14, 
        paddingVertical: 4, 
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    heartCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceText: { fontSize: 15, fontWeight: '800', marginLeft: 10 },
    searchWrapper: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        height: 50, 
        borderRadius: 15, 
        paddingHorizontal: 15, 
        marginHorizontal: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    searchInput: { flex: 1, height: '100%', fontSize: 15 },
    tabContainer: { 
        flexDirection: 'row', 
        marginBottom: 15, 
        marginTop: 15, 
        paddingHorizontal: 20,
        gap: 10, 
        alignItems: 'center',
    },
    tab: { 
        paddingVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabText: { 
        fontSize: 15,
        letterSpacing: -0.3,
    },
    activeTabText: {
        fontFamily: 'Outfit_800ExtraBold',
    },
    inactiveTabText: {
        fontFamily: 'Outfit_500Medium',
    },
    tabIndicator: {
        width: 20,
        height: 4,
        borderRadius: 2,
        marginTop: 4,
    },
    userCard: { marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 16 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    avatarContainer: { position: 'relative' },
    onlineBadge: { position: 'absolute', bottom: 0, right: 0, width: 13, height: 13, borderRadius: 6.5, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#110C24' },
    infoContainer: { marginLeft: 12, flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 1 },
    name: { fontSize: 14.5, fontWeight: 'bold' },
    chipsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: 4,
    },
    infoChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        maxWidth: 80,
    },
    infoChipText: {
        fontSize: 9,
        fontWeight: '700',
    },
    chipDivider: {
        color: 'rgba(255, 255, 255, 0.2)',
        marginHorizontal: 3,
        fontSize: 10,
        fontWeight: 'bold',
    },
    premiumVipBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 4 },
    premiumVipText: { color: 'white', fontSize: 9, fontWeight: 'bold' },
    bioText: { fontSize: 10, marginTop: 8, lineHeight: 15 },
    interestsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
    },
    interestBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
    },
    interestText: {
        fontSize: 9,
        fontWeight: '700',
    },
    albumScroll: { marginTop: 10 },
    albumImage: { width: 70, height: 70, borderRadius: 12, marginRight: 10 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { marginTop: 15, fontSize: 16, fontWeight: '500' },
    partyBannerWrapper: {
        paddingHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
    },
    partyBanner: {
        borderRadius: 20,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    partyBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    partyIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    partyTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    partyTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    partySubtitle: {
        color: 'rgba(255, 255, 255, 0.75)',
        fontSize: 11,
        marginTop: 2,
    },
    partyBadge: {
        backgroundColor: '#ef4444',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    partyBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
});

