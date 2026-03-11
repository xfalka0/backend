import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Dimensions, ScrollView, Alert, TextInput, Modal, Pressable, ActivityIndicator } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL, SOCKET_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { Motion } from '../components/motion/MotionSystem';
import VipFrame from '../components/ui/VipFrame';
import HiButton from '../components/ui/HiButton';
import PromoBanner from '../components/ui/PromoBanner';
import StoryRing from '../components/animated/StoryRing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InteractionManager, Platform } from 'react-native';
import { FadeIn } from 'react-native-reanimated';
import DestinyMatchModal from '../components/DestinyMatchModal';
import DestinyHero from '../components/DestinyHero';
import GlassCard from '../components/ui/GlassCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import SwipeDeck from '../components/discovery/SwipeDeck';
import HeroSection from '../components/hero/HeroSection';
import PremiumBackground from '../components/animated/PremiumBackground';
import PromotedProfiles from '../components/home/PromotedProfiles';
import ModernAlert from '../components/ui/ModernAlert';
import FloatingParticles from '../components/hero/FloatingParticles';
import { resolveImageUrl } from '../utils/imageUtils';

import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    interpolate,
    withRepeat,
    withSequence,
    withTiming,
    Extrapolate
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width * 0.85;
const BANNER_SPACER = (width - BANNER_WIDTH) / 2;

let lastProfileTap = 0;

const FallbackImage = ({ url, style, theme }) => {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setHasError(false);
    }, [url]);

    if (hasError || !url) {
        return (
            <View style={[style, { alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="image-outline" size={24} color={theme?.colors?.textSecondary || 'rgba(255,255,255,0.3)'} />
            </View>
        );
    }

    return (
        <Image
            key={url}
            source={{ uri: url }}
            style={style}
            onError={() => setHasError(true)}
        />
    );
};

const OperatorItem = React.memo(({ item, navigation, user, theme, themeMode, balance, onHiPress }) => (

    <View>
        <GlassCard style={styles.userCard} intensity={40}>
            <View style={styles.cardHeader}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    delayPressIn={0}
                    style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}
                    onPress={() => {
                        const now = Date.now();
                        if (now - lastProfileTap < 800) return;
                        lastProfileTap = now;
                        navigation.navigate('OperatorProfile', { operator: item, user });
                    }}
                >
                    <View style={styles.avatarContainer}>
                        <StoryRing hasNewStory={!!item.has_active_story} size={68}>
                            <VipFrame level={item.gender === 'coin_bayisi' ? 'dealer' : (item.vip_level || 0)} avatar={item.avatar_url} size={65} isStatic={true} />
                        </StoryRing>
                        {item.is_online && <View style={styles.onlineBadge} />}
                    </View>
                    <View style={styles.infoContainer}>
                        <View style={styles.nameRow}>
                            <Text
                                style={[styles.name, { color: theme.colors.text, flexShrink: 1 }]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                onLongPress={() => {
                                    const msg = `ID: ${item.id}\nAvatar: ${item.avatar_url}\nPhotos: ${item.photos?.length || 0}`;
                                    Alert.alert("Profil Debug", msg);
                                }}
                            >
                                {item.name}
                            </Text>
                            {item.vip_level > 0 && (
                                <LinearGradient
                                    colors={item.vip_level >= 6 ? ['#1a1a1b', '#000000'] : item.vip_level >= 4 ? ['#fbbf24', '#7c3aed'] : ['#a855f7', '#ec4899']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={styles.premiumVipBadge}
                                >
                                    <Ionicons name="star" size={10} color="#fff" />
                                    <Text style={styles.premiumVipText}>VIP {item.vip_level}</Text>
                                </LinearGradient>
                            )}
                            <View style={styles.verifiedBadge}><Ionicons name="checkmark-circle" size={16} color="#3b82f6" /></View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <Text style={[styles.jobText, { color: theme.colors.textSecondary }]} numberOfLines={1}>{item.job || 'Öğrenci'}</Text>
                            {item.age && (
                                <View style={[styles.ageBadge, { backgroundColor: item.gender === 'erkek' ? '#3b82f6' : '#f472b6' }]}>
                                    <Ionicons name={item.gender === 'erkek' ? "male" : "female"} size={12} color="white" />
                                    <Text style={styles.ageBadgeText}>{item.age}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </TouchableOpacity>
                <View style={styles.hiButtonContainer}>
                    <HiButton
                        operatorId={item.id}
                        userBalance={balance}
                        cost={10}
                        onPress={() => navigation.navigate('Chat', { operatorId: item.id, name: item.name, gender: item.gender, avatar_url: item.avatar_url, user })}
                        onHiPress={() => onHiPress(item)}
                    />
                </View>
            </View>

            {item.bio && (
                <View style={[styles.cardBioContainer, { backgroundColor: themeMode === 'dark' ? 'rgba(15, 23, 42, 0.4)' : 'rgba(15, 23, 42, 0.05)' }]}>
                    <Text style={[styles.cardBioBody, { color: theme.colors.textSecondary }]} numberOfLines={3}>{item.bio}</Text>
                </View>
            )}

            {item.photos && item.photos.length > 0 && (
                <View style={styles.albumContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albumScroll}>
                        {item.photos.map((rawUrl, idx) => {
                            const photoUrl = resolveImageUrl(rawUrl);
                            if (!photoUrl) return null;
                            return (
                                <View key={`${item.id}_album_${idx}`} style={styles.albumImageWrapper}>
                                    <FallbackImage url={photoUrl} style={[styles.albumImage, { backgroundColor: theme.colors.glass }]} theme={theme} />
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>
            )}
        </GlassCard>
    </View>
));

export default function HomeScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { theme, themeMode } = useTheme();
    const isFetchingRef = useRef(false);
    const { user: routeUser, gender } = route.params || {};
    const TEST_USER_ID = 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b';
    const user = React.useMemo(() => {
        return routeUser ? { ...routeUser, name: routeUser.name || routeUser.display_name || routeUser.username || 'Kullanıcı' } : { id: TEST_USER_ID, name: 'Misafir', hearts: 0, balance: 0 };
    }, [routeUser]);
    const [balance, setBalance] = useState(user.balance || user.hearts || 0);
    const [operators, setOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [promotedProfiles, setPromotedProfiles] = useState([]);
    const [isBoosted, setIsBoosted] = useState(false);
    const [activeTab, setActiveTab] = useState('Önerilen');
    const [searchText, setSearchText] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [showWelcomeAlert, setShowWelcomeAlert] = useState(false);
    const [filterOptions, setFilterOptions] = useState({ gender: 'all', online: false });
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isMoreLoading, setIsMoreLoading] = useState(false);
    const LIMIT = 10;

    // Fake Message System State
    const [fakeMessage, setFakeMessage] = useState(null);
    const fakeMessageAnimY = useSharedValue(-150);

    const fakeMessageStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: fakeMessageAnimY.value }]
        };
    });

    const FAKE_MESSAGES = [
        "selam tanisalim mi",
        "merhaba buralarda yenisin sanrm",
        "hey ordamisin",
        "naber nasilsin",
        "selam napiysn",
        "cok tatlisina benziyosun tanisalim mi",
        "profilin cok guzel mis",
        "selm nasilsin canim",
        "slm tanismak ister misin"
    ];

    useEffect(() => {
        let fakeMsgTimer;
        let hideMsgTimer;

        const triggerFakeMessage = () => {
            // Only if there are female operators loaded and user is not admin
            const femaleOps = operators.filter(op => op.gender === 'kadin' || op.gender === 'female' || (op.gender && op.gender.toLowerCase() === 'kadin'));

            if (femaleOps.length > 0) {
                const randomOp = femaleOps[Math.floor(Math.random() * femaleOps.length)];
                const randomMsg = FAKE_MESSAGES[Math.floor(Math.random() * FAKE_MESSAGES.length)];

                setFakeMessage({ operator: randomOp, text: randomMsg });

                // Persist to backend so it stays in chat history
                axios.post(`${API_URL}/messages/internal-fake`, {
                    userId: user.id,
                    operatorId: randomOp.id,
                    content: randomMsg
                }).catch(err => console.error('[HomeScreen] Fake message persistence error:', err));

                // Slide down
                fakeMessageAnimY.value = withTiming(insets.top + 10, { duration: 600 });

                // Hide after 5 seconds
                hideMsgTimer = setTimeout(() => {
                    fakeMessageAnimY.value = withTiming(-150, { duration: 500 });
                    setTimeout(() => setFakeMessage(null), 500);
                }, 5000);
            }
        };

        // Trigger between 4 and 8 seconds after mounting component
        const delay = Math.floor(Math.random() * 4000) + 4000;
        fakeMsgTimer = setTimeout(triggerFakeMessage, delay);

        return () => {
            clearTimeout(fakeMsgTimer);
            clearTimeout(hideMsgTimer);
        };
    }, [operators]); // Re-run if operators change initially (so we have data)

    useFocusEffect(
        React.useCallback(() => {
            fetchOperators(true);

            const syncLiveBalance = async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    if (token) {
                        const balRes = await axios.get(`${API_URL}/users/balance`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        if (balRes.data && balRes.data.balance !== undefined) {
                            setBalance(balRes.data.balance);
                            const storedUser = await AsyncStorage.getItem('user');
                            if (storedUser) {
                                const parsed = JSON.parse(storedUser);
                                parsed.balance = balRes.data.balance;
                                parsed.hearts = balRes.data.balance;
                                await AsyncStorage.setItem('user', JSON.stringify(parsed));
                            }
                        }
                    }
                } catch (e) {
                    // console.log('[HomeScreen] Live balance fetch failed, falling back to local');
                    const str = await AsyncStorage.getItem('user');
                    if (str) {
                        const parsedUser = JSON.parse(str);
                        setBalance(parsedUser.balance !== undefined ? parsedUser.balance : (parsedUser.hearts || 0));
                    }
                }
            };

            const checkBoostStatus = async () => {
                if (user && user.id && user.id !== TEST_USER_ID) {
                    try {
                        const token = await AsyncStorage.getItem('token');
                        if (token) {
                            const res = await axios.get(`${API_URL}/boosts/status/${user.id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            setIsBoosted(res.data.isBoosted);
                        }
                    } catch (e) {
                        console.error('[HomeScreen] Boost check failed', e);
                    }
                }
            };

            syncLiveBalance();
            checkBoostStatus();
        }, [])
    );

    useEffect(() => {
        const checkFirstLaunch = async () => {
            try {
                const hasSeenAlert = await AsyncStorage.getItem('has_seen_welcome_alert');
                if (!hasSeenAlert) {
                    setShowWelcomeAlert(true);
                    await AsyncStorage.setItem('has_seen_welcome_alert', 'true');
                }
            } catch (error) {
                console.error("Welcome alert check error:", error);
            }
        };
        checkFirstLaunch();
    }, []);

    const fetchOperators = async (reset = false, isLoadMore = false, overrideTab = activeTab) => {
        if (isFetchingRef.current) return;
        if (isLoadMore && !hasMore) return;

        isFetchingRef.current = true;

        try {
            if (isLoadMore) setIsMoreLoading(true);
            else setLoading(true);

            const currentPage = reset ? 1 : page;
            const token = user?.token || await AsyncStorage.getItem('token');

            let res;
            if (!token) {
                res = await axios.get(`${API_URL}/operators?gender=kadin&page=${currentPage}&limit=${LIMIT}&tab=${encodeURIComponent(overrideTab)}`);
            } else {
                res = await axios.get(`${API_URL}/discovery`, {
                    params: { page: currentPage, limit: LIMIT, tab: overrideTab },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }

            const newData = res.data?.data || res.data || [];

            if (reset) {
                setOperators(newData);
                setPage(2);
                setHasMore(newData.length === LIMIT);

                // Generate promoted profiles (only on first load)
                if (newData.length > 0) {
                    const shuffled = [...newData].sort(() => Math.random() - 0.5).slice(0, 10);
                    setPromotedProfiles(shuffled);
                }
                setLoading(false);
                setIsMoreLoading(false);
            } else {
                setOperators(prev => {
                    // Filter out duplicates just in case
                    const existingIds = new Set(prev.map(op => op.id));
                    const uniqueNewData = newData.filter(op => !existingIds.has(op.id));
                    return [...prev, ...uniqueNewData];
                });
                setPage(prev => prev + 1);
                setHasMore(newData.length === LIMIT);
                setLoading(false);
                setIsMoreLoading(false);
            }

        } catch (error) {
            console.error("Fetch Discovery Error:", error);

            if (error.response?.status === 401 || error.response?.status === 403) {
                console.warn("[Home] Token invalid detected, clearing session.");
                await AsyncStorage.multiRemove(['token', 'user']);
                navigation.replace('Auth');
                return;
            }

            // Fallback
            try {
                const res = await axios.get(`${API_URL}/operators`);
                setOperators(res.data);
                setHasMore(false);
            } catch (inner) {
                console.error("Fallback error:", inner);
            } finally {
                setLoading(false);
                setIsMoreLoading(false);
            }
        } finally {
            isFetchingRef.current = false;
        }
    };

    const handleLoadMore = React.useCallback(() => {
        if (!loading && !isFetchingRef.current && hasMore) {
            console.log(`[HomeScreen] Triggering load more. Current page: ${page}`);
            fetchOperators(false, true);
        }
    }, [loading, isMoreLoading, hasMore, page]);

    const [showMatchModal, setShowMatchModal] = useState(false);

    const getDestinyColors = () => {
        if (themeMode === 'dark') return {
            outer: ['#2e1065', '#4c1d95', '#ec4899'],
            inner: '#1e1b4b',
            title: '#ec4899',
            text: 'white',
            subtext: '#e2e8f0'
        };
        return {
            outer: ['#f472b6', '#a855f7', '#8b5cf6'],
            inner: theme.colors.card,
            title: theme.colors.primary,
            text: theme.colors.text,
            subtext: theme.colors.textSecondary
        };
    };

    const renderDestinyBanner = () => (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowMatchModal(true)}
            style={{ marginHorizontal: 20, marginBottom: 25 }}
        >
            <LinearGradient
                colors={getDestinyColors().outer}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    borderRadius: 28,
                    padding: 3,
                    elevation: 10,
                    shadowColor: '#ec4899',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: themeMode === 'dark' ? 0.4 : 0.1,
                    shadowRadius: 15,
                }}
            >
                <View style={{
                    backgroundColor: getDestinyColors().inner,
                    borderRadius: 26,
                    padding: 24,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    overflow: 'hidden',
                    minHeight: 110
                }}>
                    {/* Background decoration */}
                    <View style={{
                        position: 'absolute',
                        right: -20,
                        top: -20,
                        width: 100,
                        height: 100,
                        borderRadius: 50,
                        backgroundColor: '#ec4899',
                        opacity: 0.15,
                        transform: [{ scale: 1.5 }]
                    }} />

                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{
                            color: getDestinyColors().title,
                            fontWeight: '900',
                            fontSize: 11,
                            letterSpacing: 2,
                            marginBottom: 8,
                            textTransform: 'uppercase'
                        }}>
                            PREMIUM EŞLEŞME
                        </Text>
                        <Text style={{
                            color: getDestinyColors().text,
                            fontWeight: 'bold',
                            fontSize: 22,
                            marginBottom: 6,
                            lineHeight: 28
                        }}>
                            Eşleşmeni Bul
                        </Text>
                        <Text style={{
                            color: getDestinyColors().subtext,
                            fontSize: 13,
                            opacity: 0.8,
                            fontWeight: '500'
                        }}>
                            Kader seni biriyle buluşturmak üzere...
                        </Text>
                    </View>

                    <View style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: 'rgba(236, 72, 153, 0.15)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: 'rgba(236, 72, 153, 0.5)',
                        elevation: 5,
                        shadowColor: "#ec4899",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.5,
                        shadowRadius: 10,
                    }}>
                        <Ionicons name="infinite" size={28} color="#ec4899" />
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );


    const filteredOperators = React.useMemo(() => {
        let result = operators;

        // Search Filter
        if (searchText) {
            result = result.filter(op =>
                op.name.toLowerCase().includes(searchText.toLowerCase()) ||
                (op.job && op.job.toLowerCase().includes(searchText.toLowerCase()))
            );
        }

        // Advanced Filters
        if (filterOptions.gender !== 'all') {
            const targetGender = filterOptions.gender === 'female' ? ['kadin', 'female'] : ['erkek', 'male'];
            result = result.filter(op => targetGender.includes(op.gender?.toLowerCase()));
        }

        if (filterOptions.online) {
            result = result.filter(op => op.is_online);
        }

        return result;
    }, [operators, searchText, filterOptions]);

    const handleTabPress = (tabName) => {
        if (activeTab === tabName) return;
        setActiveTab(tabName);

        // InteractionManager tends to hang indefinitely if there are infinite loop animations (like PremiumBackground)
        // Set state synchronously and fetch data
        setPage(1);
        setOperators([]);
        setHasMore(true);
        fetchOperators(true, false, tabName);
    };

    const handleHiPress = React.useCallback(async (item) => {
        try {
            const res = await axios.post(`${API_URL}/messages/send-hi`, {
                userId: user.id,
                operatorId: item.id,
                content: 'Merhaba 👋'
            });

            if (res.data.success) {
                if (res.data.newBalance !== undefined) {
                    setBalance(res.data.newBalance);
                    const storedUser = await AsyncStorage.getItem('user');
                    if (storedUser) {
                        const parsed = JSON.parse(storedUser);
                        parsed.balance = res.data.newBalance;
                        parsed.hearts = res.data.newBalance;
                        await AsyncStorage.setItem('user', JSON.stringify(parsed));
                    }
                }
            }
        } catch (e) {
            console.error('[HomeScreen] Hi message err', e);
            if (e.response?.data?.insufficientFunds) {
                Alert.alert("Bakiye Yetersiz", e.response.data.error);
            } else if (e.response?.data?.error) {
                Alert.alert("Mesaj Hatası", e.response.data.error);
            } else {
                Alert.alert("Hata", "Sunucuya ulaşılamadı. Lütfen tekrar deneyin.");
            }
        }
    }, [user.id, API_URL]);

    const renderOperator = React.useCallback(({ item }) => (
        <OperatorItem
            item={item}
            navigation={navigation}
            user={user}
            theme={theme}
            themeMode={themeMode}
            balance={balance}
            onHiPress={handleHiPress}
        />
    ), [navigation, user, theme, themeMode, balance, handleHiPress]);

    const renderActionCards = () => (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 15, gap: 12 }}
        >
            {/* Görüntülü Arama Kartı */}
            <TouchableOpacity activeOpacity={0.8} style={[styles.actionCard, { backgroundColor: '#a78bfa' }]}>
                <View style={[styles.actionIconBg, { backgroundColor: '#c4b5fd' }]}>
                    <Ionicons name="videocam" size={28} color="white" />
                </View>
                <View style={styles.actionAvatarGroup}>
                    <Image source={{ uri: 'https://i.pravatar.cc/100?img=1' }} style={[styles.actionTinyAvatar, { zIndex: 3 }]} />
                    <Image source={{ uri: 'https://i.pravatar.cc/100?img=2' }} style={[styles.actionTinyAvatar, { zIndex: 2, marginLeft: -10 }]} />
                </View>
                <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Görüntülü</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Text style={styles.actionSubtitle}>300</Text>
                        <Image source={require('../../assets/gold_coin_3d.png')} style={{ width: 12, height: 12, marginHorizontal: 2 }} />
                        <Text style={styles.actionSubtitle}>/dakika</Text>
                    </View>
                </View>
            </TouchableOpacity>

            {/* Sesli Arama Kartı */}
            <TouchableOpacity activeOpacity={0.8} style={[styles.actionCard, { backgroundColor: '#f472b6' }]}>
                <View style={[styles.actionIconBg, { backgroundColor: '#fbcfe8' }]}>
                    <Ionicons name="mic" size={28} color="white" />
                </View>
                <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Sesli arama</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Text style={styles.actionSubtitle}>200</Text>
                        <Image source={require('../../assets/gold_coin_3d.png')} style={{ width: 12, height: 12, marginHorizontal: 2 }} />
                        <Text style={styles.actionSubtitle}>/dakika</Text>
                    </View>
                </View>
            </TouchableOpacity>

            {/* Ödüller Kartı */}
            <TouchableOpacity activeOpacity={0.8} style={[styles.actionCard, { backgroundColor: '#fbbf24' }]}>
                <View style={[styles.actionIconBg, { backgroundColor: '#fde68a' }]}>
                    {/* Using a star icon or coin image */}
                    <Image source={require('../../assets/gold_coin_3f.png')} style={{ width: 35, height: 35 }} />
                </View>
                <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Ödüller</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Text style={styles.actionSubtitle}>670</Text>
                        <Image source={require('../../assets/gold_coin_3d.png')} style={{ width: 12, height: 12, marginHorizontal: 2 }} />
                        <Text style={styles.actionSubtitle}>alınabilir</Text>
                    </View>
                </View>
            </TouchableOpacity>

            {/* Daha Fazla Kartı */}
            <TouchableOpacity activeOpacity={0.8} style={[styles.actionCard, { backgroundColor: '#4ade80' }]}>
                <View style={[styles.actionIconBg, { backgroundColor: '#bbf7d0' }]}>
                    <Ionicons name="gift" size={28} color="white" />
                </View>
                <View style={styles.actionTextContainer}>
                    <Text style={styles.actionTitle}>Daha</Text>
                    <Text style={styles.actionSubtitle}>Kazan</Text>
                </View>
            </TouchableOpacity>
        </ScrollView>
    );

    const ListHeader = React.useMemo(() => (
        <View>
            <HeroSection
                onCoinPress={() => navigation.navigate('PurchaseInfo', { user })}
                onExplorePress={() => setActiveTab('Önerilen')}
                onResellerPress={() => navigation.navigate('PurchaseInfo', { user })}
                onDestinyPress={() => setShowMatchModal(true)}
            />
            <PromotedProfiles
                data={promotedProfiles}
                isBoosted={isBoosted}
                onProfilePress={(profile) => {
                    console.log(`[HomeScreen] Promoted profile click: ${profile.name}`);
                    navigation.navigate('OperatorProfile', { operator: profile, user });
                }}
                user={user}
            />
            <View style={{ marginHorizontal: 16, marginBottom: 15, marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginRight: 10 }}>
                        {['Önerilen', 'Yeni', 'Popüler'].map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => handleTabPress(tab)}
                                style={{
                                    marginRight: 10,
                                    paddingHorizontal: 16,
                                    paddingVertical: 8,
                                    borderRadius: 20,
                                    backgroundColor: activeTab === tab ? theme.colors.primary : theme.colors.glass,
                                    borderWidth: 1,
                                    borderColor: activeTab === tab ? theme.colors.primary : theme.colors.glassBorder
                                }}
                            >
                                <Text style={{ fontSize: 13, fontWeight: '600', color: activeTab === tab ? 'white' : theme.colors.textSecondary }}>{tab}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                            onPress={() => setShowSearch(!showSearch)}
                            style={{
                                width: 38, height: 38, borderRadius: 19,
                                backgroundColor: showSearch ? theme.colors.primary : theme.colors.glass,
                                alignItems: 'center', justifyContent: 'center',
                                borderWidth: 1, borderColor: showSearch ? theme.colors.primary : theme.colors.glassBorder
                            }}>
                            <Ionicons name="search" size={18} color={showSearch ? 'white' : theme.colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowFilterModal(true)}
                            style={{
                                width: 38, height: 38, borderRadius: 19,
                                backgroundColor: (filterOptions.gender !== 'all' || filterOptions.online) ? theme.colors.primary : theme.colors.glass,
                                alignItems: 'center', justifyContent: 'center',
                                borderWidth: 1, borderColor: (filterOptions.gender !== 'all' || filterOptions.online) ? theme.colors.primary : theme.colors.glassBorder
                            }}>
                            <Ionicons name="options" size={10} color={(filterOptions.gender !== 'all' || filterOptions.online) ? 'white' : theme.colors.text} />
                        </TouchableOpacity>
                    </View>
                </View>
                {showSearch && (
                    <Motion.SlideUp>
                        <View style={{ marginTop: 15 }}>
                            <View style={{
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: theme.colors.glass,
                                borderColor: theme.colors.glassBorder,
                                borderWidth: 1,
                                borderRadius: 12, paddingHorizontal: 12, height: 46
                            }}>
                                <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={{ marginRight: 10 }} />
                                <TextInput
                                    placeholder="Bir isim ara"
                                    placeholderTextColor={theme.colors.textSecondary}
                                    style={{ flex: 1, color: theme.colors.text, fontSize: 14 }}
                                    value={searchText}
                                    onChangeText={setSearchText}
                                />
                                {searchText.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchText('')}>
                                        <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </Motion.SlideUp>
                )}
            </View>
        </View>
    ), [activeTab, promotedProfiles, showSearch, searchText, filterOptions, theme, user]);

    // Removed faulty getItemLayout which caused phantom scrolling space on Android due to dynamic item heights

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {themeMode === 'dark' && <PremiumBackground />}
            <FlatList
                data={filteredOperators}
                keyExtractor={item => item.id.toString()}
                extraData={balance}
                renderItem={renderOperator}
                // getItemLayout removed to fix dynamic height calculating bug
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={ListHeader}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5} // Trigger earlier for seamless scroll
                initialNumToRender={10}

                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
                keyboardShouldPersistTaps="handled"
                bounces={false}
                overScrollMode="never"
                ListFooterComponent={
                    <View style={{
                        paddingTop: 10,
                        paddingBottom: 40,
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%'
                    }}>
                        {isMoreLoading && (
                            <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 15 }} />
                        )}
                        {!hasMore && operators.length > 0 && (
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 15, opacity: 0.8 }}>
                                Şimdilik bu kadar...
                            </Text>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    loading ? (
                        <View style={{ paddingTop: 10 }}>
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </View>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Sonuç bulunamadı.</Text>
                        </View>
                    )
                }
            />
            {showMatchModal && <DestinyMatchModal visible={showMatchModal} onClose={() => setShowMatchModal(false)} operators={operators} navigation={navigation} user={user} />}
            <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
                <View style={styles.modalOverlay}>
                    <GlassCard style={styles.modalContent} intensity={80} tint="dark">
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Kriterlerini Belirle</Text>
                            <TouchableOpacity onPress={() => setShowFilterModal(false)} style={styles.closeButton}><Ionicons name="close" size={24} color="white" /></TouchableOpacity>
                        </View>
                        <View style={styles.filterSection}>
                            <Text style={styles.filterLabel}>Cinsiyet</Text>
                            <View style={styles.filterOptions}>
                                {['all', 'female', 'male'].map((g) => (
                                    <TouchableOpacity key={g} style={[styles.filterChip, filterOptions.gender === g && styles.filterChipActive]} onPress={() => setFilterOptions(prev => ({ ...prev, gender: g }))}>
                                        <Text style={[styles.filterChipText, filterOptions.gender === g && styles.filterChipTextActive]}>{g === 'all' ? 'Hepsi' : g === 'female' ? 'Kadın' : 'Erkek'}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        <View style={styles.filterSection}>
                            <Text style={styles.filterLabel}>Durum</Text>
                            <TouchableOpacity style={[styles.filterChip, filterOptions.online && styles.filterChipActive]} onPress={() => setFilterOptions(prev => ({ ...prev, online: !prev.online }))}>
                                <Ionicons name={filterOptions.online ? "radio-button-on" : "radio-button-off"} size={16} color={filterOptions.online ? "white" : "#64748b"} style={{ marginRight: 8 }} />
                                <Text style={[styles.filterChipText, filterOptions.online && styles.filterChipTextActive]}>Sadece Online</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.applyButton} onPress={() => setShowFilterModal(false)}>
                            <LinearGradient colors={['#8b5cf6', '#ec4899']} style={styles.applyButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                <Text style={styles.applyButtonText}>Filtreleri Uygula</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </GlassCard>
                </View>
            </Modal>

            <ModernAlert
                visible={showWelcomeAlert}
                title="Hoş Geldiniz! 👋"
                message="Uygulamamız henüz çok yenidir. Sizlere daha iyi bir deneyim sunabilmek için değerli önerilerinizi ve geri bildirimlerinizi bekliyoruz. Keyifli vakit geçirmeniz dileğiyle!"
                type="info"
                onClose={() => setShowWelcomeAlert(false)}
            />

            {/* Fake Incoming Message Toast */}
            {fakeMessage && (
                <Animated.View style={[{
                    position: 'absolute',
                    top: 0,
                    left: 20,
                    right: 20,
                    zIndex: 9999,
                    elevation: 100,
                }, fakeMessageStyle]}>
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => {
                            // Hide the message
                            fakeMessageAnimY.value = withTiming(-150, { duration: 300 });
                            setTimeout(() => setFakeMessage(null), 300);

                            // Navigate to chat
                            navigation.navigate('Chat', {
                                operatorId: fakeMessage.operator.id,
                                name: fakeMessage.operator.name,
                                gender: fakeMessage.operator.gender,
                                avatar_url: fakeMessage.operator.avatar_url,
                                user
                            });
                        }}
                    >
                        <GlassCard intensity={80} tint="dark" style={{
                            padding: 12,
                            borderRadius: 20,
                            flexDirection: 'row',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: 'rgba(236,72,153, 0.5)', // Pink tinted border
                            shadowColor: '#ec4899',
                            shadowOffset: { width: 0, height: 10 },
                            shadowOpacity: 0.3,
                            shadowRadius: 15,
                        }}>
                            <View style={{ position: 'relative' }}>
                                <Image
                                    source={{ uri: resolveImageUrl(fakeMessage.operator.avatar_url) }}
                                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.glass }}
                                />
                                <View style={{
                                    position: 'absolute', bottom: -2, right: -2,
                                    width: 14, height: 14, borderRadius: 7,
                                    backgroundColor: '#10b981',
                                    borderWidth: 2, borderColor: '#0f172a',
                                    justifyContent: 'center', alignItems: 'center'
                                }}>
                                    <Text style={{ color: 'white', fontSize: 7, fontWeight: 'bold' }}>1</Text>
                                </View>
                            </View>

                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>{fakeMessage.operator.name}</Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Şimdi</Text>
                                </View>
                                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 }}>{fakeMessage.text}</Text>
                            </View>
                        </GlassCard>
                    </TouchableOpacity>
                </Animated.View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    listContent: {
        flexGrow: 1,
        paddingBottom: 110, // Just enough to clear the bottom tab bar
    },
    headerContainer: { paddingHorizontal: 20, marginBottom: 15, marginTop: 10 },
    topBar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 20 },
    logoText: { fontSize: 26, fontWeight: '900' },
    logoDot: { color: '#d946ef' },
    coinBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    coinText: { color: 'white', fontWeight: 'bold', marginLeft: 6 },
    tabScroll: { marginBottom: 10 },
    tabButton: { marginRight: 25, alignItems: 'center' },
    tabText: { color: '#64748b', fontSize: 16, fontWeight: '700' },
    activeTabText: { fontWeight: 'bold' },
    activeIndicator: { width: 16, height: 4, backgroundColor: '#d946ef', borderRadius: 2, marginTop: 6 },
    bannerWrapper: { marginVertical: 10 },
    bannerScrollContent: { paddingVertical: 10 },
    bannerCardContainer: {
        width: BANNER_WIDTH,
        height: 160,
        borderRadius: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    bannerCard: {
        flex: 1,
        borderRadius: 24,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden'
    },
    bannerContent: { flex: 1, justifyContent: 'center' },
    bannerTitle: { color: 'white', fontSize: 12, fontWeight: '800', opacity: 0.8, letterSpacing: 1 },
    bannerSubtitle: { color: 'white', fontSize: 22, fontWeight: '900', marginVertical: 4 },
    bannerButton: { backgroundColor: 'white', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 12, alignSelf: 'flex-start', marginTop: 12 },
    bannerButtonText: { color: '#1e293b', fontWeight: 'bold', fontSize: 13 },
    bannerIconWrapper: { marginLeft: 10, position: 'relative' },
    iconGlow: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'white',
        opacity: 0.2,
        top: 15,
        left: 15,
        shadowRadius: 30,
        shadowOpacity: 1,
        elevation: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginHorizontal: 20,
        marginBottom: 15,
        marginTop: 10
    },
    userCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 24,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 12,
    },
    onlineBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#10b981',
        borderWidth: 2,
        borderColor: '#0f172a',
    },
    infoContainer: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: -5,
    },
    name: {
        fontSize: 17,
        fontWeight: 'bold',
        marginRight: 6,
    },
    premiumVipBadge: {
        flexDirection: 'row',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        alignItems: 'center',
        marginRight: 6,
    },
    premiumVipText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 2,
    },
    verifiedBadge: {
        marginLeft: 2,
    },
    ageBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        marginLeft: 8,
    },
    ageBadgeText: {
        color: 'white',
        fontSize: 8,
        fontWeight: 'bold',
        marginLeft: 2,
    },
    jobText: { fontSize: 13, marginTop: 2 },

    // Bio Stilleri
    cardBioContainer: {
        padding: 2,
        borderRadius: 16,
        marginBottom: 12,
    },
    cardBioTitle: {
        color: '#d946ef', // Marka rengi
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    cardBioBody: {
        fontSize: 12, // Reduced from 13
        lineHeight: 16,
    },

    // Albüm Stilleri
    albumContainer: {
        marginTop: 1,
    },
    albumScroll: {
        paddingRight: 10,
    },
    albumImage: {
        width: 50, // Reduced from 80
        height: 100, // Reduced from 100
        borderRadius: 5,
        marginRight: 8,
    },

    hiButtonContainer: { marginLeft: 10, alignItems: 'center', justifyContent: 'center' },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#64748b' },

    // Modal Stilleri
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        padding: 24,
        paddingBottom: 40,
        borderWidth: 1,
        borderBottomWidth: 0,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterSection: {
        marginBottom: 24,
    },
    filterLabel: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    filterOptions: {
        flexDirection: 'row',
        gap: 12,
    },
    filterChip: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
    },
    filterChipActive: {
        backgroundColor: '#8b5cf6',
        borderColor: '#a78bfa',
    },
    filterChipText: {
        fontSize: 14,
        fontWeight: '600',
    },
    filterChipTextActive: {
        color: 'white',
    },
    applyButton: {
        marginTop: 10,
    },
    applyButtonGradient: {
        height: 56,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    applyButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800',
    },
});
