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
import HiButton from '../components/ui/HiButton';
import StoryRing from '../components/animated/StoryRing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassCard from '../components/ui/GlassCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import DestinyHero from '../components/DestinyHero';
import { resolveImageUrl } from '../utils/imageUtils';

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

const MALE_NAME_HINTS = new Set([
    'abdurrahman', 'abdullah', 'abdulkadir', 'abdulkerim', 'adem', 'adnan', 'ahmet', 'ali', 'alper', 'anil', 'arda',
    'arif', 'atilla', 'aziz', 'ayhan', 'aykut', 'baris', 'batuhan', 'bayram', 'berat', 'berk', 'berkay', 'bekir',
    'bora', 'bulent', 'burak', 'cafer', 'cagatay', 'celal', 'cem', 'cemal', 'cihan', 'cengiz', 'davut', 'dogan',
    'dogukan', 'ekrem', 'emir', 'emrah', 'emre', 'enes', 'enver', 'eray', 'ercan', 'erdem', 'erdogan', 'eren',
    'erhan', 'erol', 'ersin', 'faruk', 'fatih', 'ferhat', 'fikret', 'fuat', 'furkan', 'gokhan', 'hakan', 'halil',
    'hamza', 'harun', 'hasan', 'haydar', 'huseyin', 'ibrahim', 'ihsan', 'ilhan', 'isa', 'ismail', 'ismet', 'kadir',
    'kaan', 'kamil', 'kazim', 'kemal', 'kerem', 'koray', 'levent', 'mahmut', 'mehmet', 'mert', 'mesut', 'metin',
    'muhammed', 'muhammet', 'murat', 'mustafa', 'muzaffer', 'necati', 'necip', 'nihat', 'nuri', 'nusret', 'okan',
    'omer', 'onur', 'orhan', 'osman', 'ozan', 'ozgur', 'polat', 'ramazan', 'recep', 'ridvan', 'riza', 'sabri',
    'sahin', 'sait', 'salih', 'sami', 'samet', 'savas', 'sedat', 'sefa', 'selcuk', 'selim', 'semih', 'serdar',
    'serhat', 'sinan', 'suat', 'suleyman', 'taha', 'tamer', 'taner', 'tarik', 'tayfun', 'taylan', 'temel', 'tolga',
    'tuncay', 'turgut', 'ufuk', 'ugur', 'umit', 'umut', 'utku', 'uzay', 'vahit', 'velat', 'veli', 'volkan', 'yahya',
    'yakup', 'yasin', 'yavuz', 'yunus', 'yusuf', 'zafer', 'zeki', 'ziya'
]);

const getProfileGender = (profile = {}) => {
    const raw = (profile.gender || '').toString().toLowerCase();
    if (raw.includes('bayi')) return 'coin_bayisi';
    const name = normalizeText(profile.name || '');
    if (MALE_NAME_HINTS.has(name.split(' ')[0])) return 'erkek';
    if (raw.includes('erkek') || raw.includes('male')) return 'erkek';
    return 'kadin';
};

const OperatorItem = React.memo(({ item, navigation, user, theme, onHiPress }) => {
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
                        <StoryRing hasNewStory={!!item.has_active_story} size={54}>
                            <VipFrame level={profileGender === 'coin_bayisi' ? 'dealer' : (item.vip_level || 0)} avatar={item.avatar_url} size={50} isStatic={true} />
                        </StoryRing>
                        {item.is_online && <View style={styles.onlineBadge} />}
                    </View>
                    <View style={styles.infoContainer}>
                        <View style={styles.nameRow}>
                            <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>
                            {item.vip_level > 0 && (
                                <LinearGradient colors={['#a855f7', '#ec4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.premiumVipBadge}>
                                    <Text style={styles.premiumVipText}>VIP {item.vip_level}</Text>
                                </LinearGradient>
                            )}
                            <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {item.job ? (
                                <Text style={[styles.jobText, { color: theme.colors.textSecondary }]}>{item.job}</Text>
                            ) : null}
                            {item.age && (
                                <View style={[styles.ageBadge, { backgroundColor: profileGender === 'erkek' ? '#3b82f6' : '#f472b6' }]}>
                                    <Ionicons name={profileGender === 'erkek' ? "male" : "female"} size={8} color="white" />
                                    <Text style={styles.ageBadgeText}>{item.age}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
                <View style={{ transform: [{ scale: 0.9 }] }}>
                    <HiButton
                        operatorId={item.id}
                        onPress={() => navigation.navigate('Chat', { operatorId: item.id, name: item.name, gender: item.gender, avatar_url: item.avatar_url, user })}
                        onHiPress={handleLocalHiPress}
                    />
                </View>
            </View>
            {item.bio && <Text style={[styles.bioText, { color: theme.colors.textSecondary }]} numberOfLines={2}>{item.bio}</Text>}
            {(() => {
                let ints = item.interests || [];
                if (typeof ints === 'string') {
                    try { ints = JSON.parse(ints); }
                    catch (e) { ints = ints.split(',').map(i => i.trim()); }
                }
                if (!Array.isArray(ints)) ints = [];
                const displayInts = ints.slice(0, 3).filter(Boolean);
                if (displayInts.length === 0) return null;
                return (
                    <View style={styles.interestsContainer}>
                        {displayInts.map((interest, idx) => (
                            <View key={idx} style={[styles.interestBadge, { backgroundColor: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.3)' }]}>
                                <Text style={[styles.interestText, { color: '#c084fc' }]}>{interest}</Text>
                            </View>
                        ))}
                    </View>
                );
            })()}
            {item.photos && item.photos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumScroll}>
                    {item.photos.map((p, i) => (
                        <Image key={i} source={{ uri: resolveImageUrl(p) }} style={styles.albumImage} />
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

    useEffect(() => {
        fetchOperators();
    }, [activeTab]);

    const fetchOperators = async () => {
        if (!refreshing) setLoading(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/discovery?tab=${activeTab}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = res.data?.data || res.data || [];
            setOperators(data);
            
            // Extract boosted/featured operators for the horizontal list
            const featured = data.filter(op => op.is_boosted || op.vip_level > 0).slice(0, 15);
            setFeaturedOperators(featured);
        } catch (e) {
            console.error('Fetch operators error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchOperators();
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
            <View style={[styles.topBar, { justifyContent: 'flex-end', height: 36, marginBottom: 2 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity 
                        onPress={() => navigation.navigate('Leaderboard')} 
                        style={[styles.smallIconBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.15)', marginRight: 10 }]}
                    >
                        <Ionicons name="trophy" size={16} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => navigation.navigate('Notifications')} 
                        style={[styles.smallIconBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.15)' }]}
                    >
                        <Ionicons name="notifications" size={16} color="white" />
                    </TouchableOpacity>
                </View>
            </View>

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

            {featuredOperators.length > 0 && (
                <PromotedProfiles 
                    data={featuredOperators} 
                    onProfilePress={(op) => navigation.navigate('OperatorProfile', { operator: op, user })}
                    theme={theme}
                />
            )}

            <View style={{ paddingHorizontal: 16 }}>
                <DestinyHero onPress={() => navigation.navigate('Keşfet')} />
            </View>
            
            <View style={styles.tabContainer}>
                {['Önerilen', 'Yeni', 'Popüler'].map(tab => (
                    <TouchableOpacity 
                        key={tab} 
                        onPress={() => setActiveTab(tab)} 
                        style={[
                            styles.tab, 
                            activeTab === tab ? { backgroundColor: theme.colors.primary } : { backgroundColor: theme.colors.glass }
                        ]}
                    >
                        <Text style={[
                            styles.tabText, 
                            activeTab === tab ? { color: 'white' } : { color: theme.colors.textSecondary }
                        ]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    ), [theme, balance, showSearch, searchText, activeTab, user, featuredOperators]);


    const filteredData = operators.filter(op => 
        normalizeText(op.name).includes(normalizeText(searchText)) ||
        normalizeText(op.job || '').includes(normalizeText(searchText))
    );

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
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={Platform.OS === 'android'}
                maxToRenderPerBatch={10}
                windowSize={5}
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
    tabContainer: { flexDirection: 'row', marginBottom: 15, marginTop: 15, paddingHorizontal: 16 },
    tab: { 
        paddingHorizontal: 20, 
        paddingVertical: 10, 
        borderRadius: 25, 
        marginRight: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    tabText: { fontSize: 13, fontWeight: '700' },
    userCard: { marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 16 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    avatarContainer: { position: 'relative' },
    onlineBadge: { position: 'absolute', bottom: 0, right: 0, width: 13, height: 13, borderRadius: 6.5, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#110C24' },
    infoContainer: { marginLeft: 12, flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 1 },
    name: { fontSize: 16, fontWeight: 'bold' },
    jobText: { fontSize: 11, marginRight: 6 },
    ageBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    ageBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold', marginLeft: 2 },
    premiumVipBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 4 },
    premiumVipText: { color: 'white', fontSize: 9, fontWeight: 'bold' },
    bioText: { fontSize: 11, marginTop: 8, lineHeight: 16 },
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
        fontSize: 10,
        fontWeight: '700',
    },
    albumScroll: { marginTop: 10 },
    albumImage: { width: 70, height: 70, borderRadius: 12, marginRight: 10 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { marginTop: 15, fontSize: 16, fontWeight: '500' }
});

