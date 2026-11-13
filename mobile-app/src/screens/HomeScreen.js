import { DISCOVERY_TABS, DEFAULT_TAB } from '../constants/tabs';
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Dimensions, ScrollView, TextInput, ActivityIndicator, Platform, StatusBar, AppState } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import VipFrame from '../components/ui/VipFrame';
import VipBadge from '../components/ui/VipBadge';
import AgencyBadge from '../components/ui/AgencyBadge';
import HiButton, { hydrateHiStatusCache } from '../components/ui/HiButton';
import StoryRing from '../components/animated/StoryRing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveImageUrl } from '../utils/imageUtils';
import { maskContactInfo } from '../utils/textUtils';
import GradientText from '../components/ui/GradientText';
import ActionCards from '../components/ui/ActionCards';
import FilterModal from '../components/ui/FilterModal';
import DestinyMatchModal from '../components/DestinyMatchModal';
import { needsGenderConfirmation } from '../components/GenderConfirmationModal';
import DestinyHero from '../components/DestinyHero';
import PremiumCoinCard from '../components/hero/PremiumCoinCard';
import { useStarterPack } from '../contexts/StarterPackContext';
import { useAppStore } from '../store/useAppStore';
import { resetTo } from '../services/navigationRef';

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



const TAB_TTL_MS = {
    online: 30 * 1000,
    default: 120 * 1000,
};

const getTabTtlMs = (tabId) => (tabId === 'online' ? TAB_TTL_MS.online : TAB_TTL_MS.default);
const AUTH_ME_FOCUS_REFRESH_MS = 15 * 1000;

const createInitialTabStates = () => {
    const map = {};
    DISCOVERY_TABS.forEach(t => {
        map[t.id] = {
            data: [],
            page: 1,
            hasMore: true,
            loading: t.id === DEFAULT_TAB,
            loadingMore: false,
            refreshing: false,
            timeoutError: false,
            initialized: false,
            lastFetchedAt: 0,
        };
    });
    return map;
};

const OperatorItem = React.memo(({ item, theme, onOpenProfile, onOpenChat, onHiPress }) => {
    const profileGender = getProfileGender(item);
    const handleLocalHiPress = React.useCallback(async () => {
        if (onHiPress) return await onHiPress(item);
        return false;
    }, [onHiPress, item]);

    const handleCardPress = React.useCallback(() => {
        onOpenProfile?.(item);
    }, [onOpenProfile, item]);

    const handleChatPress = React.useCallback(() => {
        onOpenChat?.(item);
    }, [onOpenChat, item]);

    return (
        <TouchableOpacity
            style={styles.userCard}
            activeOpacity={0.7}
            onPress={handleCardPress}
        >
            <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
                    <View style={styles.avatarContainer}>
                        {profileGender === 'coin_bayisi' ? (
                            <VipFrame level="dealer" avatar={item.avatar_url} size={54} isStatic={true} />
                        ) : item.vip_level > 0 ? (
                            <VipFrame level={item.vip_level} avatar={item.avatar_url} size={65} isStatic={true} />
                        ) : (
                            <StoryRing hasNewStory={!!item.has_active_story} size={69}>
                                <VipFrame level={0} avatar={item.avatar_url} size={65} isStatic={true} />
                            </StoryRing>
                        )}
                        {item.is_online && <View style={styles.onlineBadge} />}
                    </View>
                    <View style={styles.infoContainer}>
                        <View style={styles.nameRow}>
                            <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>{item.name}</Text>
                            <VipBadge level={item.vip_level} style={{ marginLeft: 2 }} />
                            {(item.agency_name || item.agencyName) && (
                                <AgencyBadge agencyName={item.agency_name || item.agencyName} size={16} style={{ marginLeft: 4 }} />
                            )}
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
                </View>
                <View style={{ transform: [{ scale: 0.9 }] }}>
                    <HiButton
                        operatorId={item.id}
                        onPress={handleChatPress}
                        onHiPress={handleLocalHiPress}
                    />
                </View>
            </View>
            {item.bio && <Text style={[styles.bioText, profileGender === 'coin_bayisi' && { marginTop: 14 }, { color: theme.colors.textSecondary }]} numberOfLines={2}>{maskContactInfo(item.bio)}</Text>}

            {item.photos && item.photos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumScroll}>
                    {item.photos.map((p, i) => (
                        <Image
                            key={i}
                            source={{ uri: resolveImageUrl(p, 'avatar') }}
                            style={styles.albumImage}
                        />
                    ))}
                </ScrollView>
            )}
        </TouchableOpacity>
    );
});

export default function HomeScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();
    const { handleInsufficientCoins } = useStarterPack();
    const { user: routeUser } = route.params || {};
    const storeUser = useAppStore(state => state.user);
    const storeBalance = useAppStore(state => state.balance);
    const initialUser = storeUser || routeUser || { id: 'guest', name: 'Misafir', balance: 0 };
    const [user, setUser] = useState(initialUser);
    const [balance, setBalance] = useState(initialUser?.balance || 0);

    const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
    const [tabStates, setTabStates] = useState(createInitialTabStates);
    const [searchText, setSearchText] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [currentFilters, setCurrentFilters] = useState({ gender: 'all', ageGroup: 'all' });
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [showMatchModal, setShowMatchModal] = useState(false);
    const [showGenderConfirm, setShowGenderConfirm] = useState(() => needsGenderConfirmation(initialUser));
    const prevNeedsConfirmRef = useRef(needsGenderConfirmation(initialUser));

    const currentTabState = tabStates[activeTab] || createInitialTabStates()[DEFAULT_TAB];
    const operators = currentTabState.data;
    const loading = currentTabState.loading;
    const refreshing = currentTabState.refreshing;
    const hasMore = currentTabState.hasMore;
    const loadingMore = currentTabState.loadingMore;
    const timeoutError = currentTabState.timeoutError;

    const flatListRef = useRef(null);
    const abortControllerRef = useRef(null);
    const requestIdRef = useRef(0);
    const isFetchingRef = useRef(false);
    const activeTabRef = useRef(activeTab);
    const tabStatesRef = useRef(tabStates);
    const userRef = useRef(user);
    const balanceRef = useRef(storeBalance ?? balance ?? user?.balance ?? 0);
    const hasUserScrolledRef = useRef(false);
    const shortListAutoFetchedRef = useRef({});
    const viewportHeightRef = useRef(0);
    const contentHeightRef = useRef(0);
    const isFocusedRef = useRef(true);
    const hasFocusedOnceRef = useRef(false);
    const appStateRef = useRef(AppState.currentState);
    const currentScrollYRef = useRef(0);
    const tabScrollOffsetsRef = useRef({});
    const authMeInFlightRef = useRef(false);

    activeTabRef.current = activeTab;
    tabStatesRef.current = tabStates;
    userRef.current = user;
    balanceRef.current = storeBalance ?? balance ?? user?.balance ?? 0;

    useEffect(() => {
        hydrateHiStatusCache();
    }, []);

    // Keep Home user and gender confirmation modal reactively synced to authoritative store user (/api/auth/me)
    useEffect(() => {
        if (!storeUser) return;
        setUser(storeUser);
        if (storeUser.balance !== undefined) {
            setBalance(Number(storeUser.balance) || 0);
        }
        const nextNeedsConfirm = needsGenderConfirmation(storeUser);
        if (prevNeedsConfirmRef.current && !nextNeedsConfirm) {
            shortListAutoFetchedRef.current[activeTabRef.current] = false;
            fetchOperators(1, false, activeTabRef.current);
        }
        prevNeedsConfirmRef.current = nextNeedsConfirm;
        setShowGenderConfirm(nextNeedsConfirm);
    }, [storeUser]);

    const syncUserFromServerIfStale = React.useCallback(async () => {
        if (authMeInFlightRef.current) return;
        const storeState = useAppStore.getState();
        if (storeState.bootAuthMeInFlight) return;
        if (storeState.serverUserSynced && (Date.now() - storeState.lastAuthMeAt) < AUTH_ME_FOCUS_REFRESH_MS) {
            setShowGenderConfirm(needsGenderConfirmation(storeState.user));
            return;
        }
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;
            authMeInFlightRef.current = true;
            const res = await axios.get(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 8000,
            });
            const freshUser = res.data;
            if (freshUser && freshUser.id) {
                await AsyncStorage.setItem('user', JSON.stringify(freshUser));
                useAppStore.getState().setUser(freshUser);
                useAppStore.getState().setServerAuthSync(true);
                setShowGenderConfirm(needsGenderConfirmation(freshUser));
            }
        } catch (err) {
            const status = err?.response?.status;
            if (status === 401 || status === 403) {
                await AsyncStorage.multiRemove(['token', 'user']);
                await useAppStore.getState().logout();
                resetTo('Auth');
            }
        } finally {
            authMeInFlightRef.current = false;
        }
    }, []);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState) => {
            const prevState = appStateRef.current;
            appStateRef.current = nextState;
            if (prevState.match(/inactive|background/) && nextState === 'active' && isFocusedRef.current) {
                const currentTab = activeTabRef.current;
                if (tabStatesRef.current[currentTab]?.initialized) {
                    fetchOperators(1, false, currentTab, { silent: true });
                }
                syncUserFromServerIfStale();
            }
        });
        return () => sub?.remove?.();
    }, [syncUserFromServerIfStale]);

    useFocusEffect(
        React.useCallback(() => {
            isFocusedRef.current = true;
            const loadUserAndRevalidate = async () => {
                try {
                    const currentStoreUser = useAppStore.getState().user;
                    let activeUser = currentStoreUser;
                    if (!activeUser) {
                        const storedUserStr = await AsyncStorage.getItem('user');
                        if (storedUserStr) {
                            activeUser = JSON.parse(storedUserStr);
                        }
                    }
                    if (activeUser) {
                        setUser(activeUser);
                        setBalance(activeUser.balance || 0);
                        setShowGenderConfirm(needsGenderConfirmation(activeUser));
                    }

                    // Server /api/auth/me is the single source of truth for gender_confirmed_at
                    await syncUserFromServerIfStale();

                    // Revalidate active tab silently when returning focus to HomeScreen
                    if (!hasFocusedOnceRef.current) {
                        hasFocusedOnceRef.current = true;
                    } else {
                        const currentTab = activeTabRef.current;
                        if (tabStatesRef.current[currentTab]?.initialized) {
                            fetchOperators(1, false, currentTab, { silent: true });
                        }
                    }

                    // Sync balance through shared deduplicator (skips duplicate boot call already made by ChatContext)
                    const token = await AsyncStorage.getItem('token');
                    if (token) {
                        const freshBal = await useAppStore.getState().syncBalanceWithServer({ force: false });
                        if (freshBal !== undefined && freshBal !== null) {
                            const numBal = Number(freshBal);
                            setBalance(numBal);
                            const latestUser = useAppStore.getState().user || activeUser;
                            if (latestUser && Number(latestUser.balance) !== numBal) {
                                const nextUser = { ...latestUser, balance: numBal };
                                await AsyncStorage.setItem('user', JSON.stringify(nextUser));
                                useAppStore.getState().setUser(nextUser);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error loading user in HomeScreen:', e);
                }
            };
            loadUserAndRevalidate();
            return () => {
                isFocusedRef.current = false;
            };
        }, [syncUserFromServerIfStale])
    );

    useEffect(() => {
        shortListAutoFetchedRef.current = {};
        hasUserScrolledRef.current = false;
        const resetStates = createInitialTabStates();
        Object.keys(resetStates).forEach(k => {
            resetStates[k].loading = k === activeTabRef.current;
        });
        setTabStates(resetStates);
        tabStatesRef.current = resetStates;
        fetchOperators(1, false, activeTabRef.current);

        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [currentFilters]); // Initial load + Filter changes

    const fetchOperators = async (pageNum = 1, isRefreshing = false, requestedTab = activeTabRef.current, options = {}) => {
        const isSilent = !!options.silent && pageNum === 1 && !isRefreshing;
        if (isFetchingRef.current && !isRefreshing && pageNum > 1) {
            return;
        }
        isFetchingRef.current = true;

        if (!isSilent) {
            setTabStates(prev => {
                const cur = prev[requestedTab] || createInitialTabStates()[DEFAULT_TAB];
                return {
                    ...prev,
                    [requestedTab]: {
                        ...cur,
                        refreshing: isRefreshing,
                        loading: !isRefreshing && pageNum === 1 && cur.data.length === 0,
                        loadingMore: pageNum > 1,
                        timeoutError: pageNum === 1 ? false : cur.timeoutError,
                    }
                };
            });
        }

        // Preserve requestId + AbortController race protection on tab change or refresh (pageNum === 1)
        if (pageNum === 1) {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();
        }
        const currentRequestId = ++requestIdRef.current;

        // 8 second timeout
        const timeoutId = setTimeout(() => {
            if (currentRequestId === requestIdRef.current && abortControllerRef.current) {
                abortControllerRef.current.abort('timeout');
                isFetchingRef.current = false;
                setTabStates(prev => {
                    const cur = prev[requestedTab] || createInitialTabStates()[DEFAULT_TAB];
                    return {
                        ...prev,
                        [requestedTab]: {
                            ...cur,
                            timeoutError: isSilent && cur.data.length > 0 ? cur.timeoutError : true,
                            loading: false,
                            refreshing: false,
                            loadingMore: false,
                        }
                    };
                });
            }
        }, 8000);

        try {
            const encodedTab = encodeURIComponent(requestedTab);
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/discovery?tab=${encodedTab}&page=${pageNum}&limit=30`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                signal: abortControllerRef.current?.signal
            });

            clearTimeout(timeoutId);

            if (currentRequestId !== requestIdRef.current) {
                return;
            }

            const data = res.data?.data || (Array.isArray(res.data) ? res.data : []);
            const serverHasMore = res.data?.hasMore !== undefined ? res.data.hasMore : (data.length >= 30);

            setTabStates(prev => {
                const cur = prev[requestedTab] || createInitialTabStates()[DEFAULT_TAB];
                if (pageNum === 1) {
                    let nextData = data;
                    let nextPage = 1;
                    // On silent SWR refresh when user already loaded page > 1, replace page-1 window and keep unique tail
                    if (isSilent && cur.page > 1 && cur.data.length > 30) {
                        const page1Ids = new Set(data.map(item => item.id));
                        const tail = cur.data.slice(30).filter(item => !page1Ids.has(item.id));
                        nextData = [...data, ...tail];
                        nextPage = cur.page;
                    }
                    return {
                        ...prev,
                        [requestedTab]: {
                            ...cur,
                            data: nextData,
                            page: nextPage,
                            hasMore: cur.page > 1 && isSilent ? cur.hasMore : serverHasMore,
                            initialized: true,
                            lastFetchedAt: Date.now(),
                            loading: false,
                            refreshing: false,
                            loadingMore: false,
                            timeoutError: false,
                        }
                    };
                }
                if (data.length > 0) {
                    const existingIds = new Set(cur.data.map(item => item.id));
                    const uniqueNewData = data.filter(item => !existingIds.has(item.id));
                    return {
                        ...prev,
                        [requestedTab]: {
                            ...cur,
                            data: [...cur.data, ...uniqueNewData],
                            page: pageNum,
                            hasMore: serverHasMore,
                            initialized: true,
                            loading: false,
                            refreshing: false,
                            loadingMore: false,
                        }
                    };
                }
                return {
                    ...prev,
                    [requestedTab]: {
                        ...cur,
                        hasMore: false,
                        initialized: true,
                        loading: false,
                        refreshing: false,
                        loadingMore: false,
                    }
                };
            });
        } catch (e) {
            clearTimeout(timeoutId);
            if (!axios.isCancel(e) && currentRequestId === requestIdRef.current) {
                setTabStates(prev => {
                    const cur = prev[requestedTab] || createInitialTabStates()[DEFAULT_TAB];
                    return {
                        ...prev,
                        [requestedTab]: {
                            ...cur,
                            timeoutError: isSilent && cur.data.length > 0 ? cur.timeoutError : true,
                            loading: false,
                            refreshing: false,
                            loadingMore: false,
                        }
                    };
                });
            }
        } finally {
            if (currentRequestId === requestIdRef.current) {
                isFetchingRef.current = false;
                setTabStates(prev => {
                    const cur = prev[requestedTab];
                    if (!cur || (!cur.loading && !cur.refreshing && !cur.loadingMore)) return prev;
                    return {
                        ...prev,
                        [requestedTab]: {
                            ...cur,
                            loading: false,
                            refreshing: false,
                            loadingMore: false,
                        }
                    };
                });
            }
        }
    };

    const onRefresh = () => {
        shortListAutoFetchedRef.current[activeTab] = false;
        fetchOperators(1, true, activeTab);
    };

    const handleTabPress = (tab) => {
        if (activeTab === tab) {
            // Already active, refresh
            shortListAutoFetchedRef.current[tab] = false;
            fetchOperators(1, true, tab);
            return;
        }

        // Persist scroll offset of the leaving tab and restore target tab's saved offset
        const prevTab = activeTabRef.current;
        tabScrollOffsetsRef.current[prevTab] = currentScrollYRef.current;
        const targetOffset = tabScrollOffsetsRef.current[tab] || 0;
        hasUserScrolledRef.current = targetOffset > 20;

        const cached = tabStatesRef.current[tab];
        if (cached && cached.initialized && !cached.timeoutError) {
            // Stale-while-revalidate: show cached data immediately (no spinner, no list reset)
            const isStale = !cached.lastFetchedAt || (Date.now() - cached.lastFetchedAt) >= getTabTtlMs(tab);
            setTabStates(prev => {
                const curPrevTab = prev[prevTab];
                if (!curPrevTab || (!curPrevTab.loading && !curPrevTab.refreshing && !curPrevTab.loadingMore)) return prev;
                return {
                    ...prev,
                    [prevTab]: { ...curPrevTab, loading: false, refreshing: false, loadingMore: false }
                };
            });
            setActiveTab(tab);
            currentScrollYRef.current = targetOffset;
            requestAnimationFrame(() => {
                flatListRef.current?.scrollToOffset({ offset: targetOffset, animated: false });
            });

            if (isStale) {
                fetchOperators(1, false, tab, { silent: true });
            } else {
                if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                }
                requestIdRef.current += 1;
                isFetchingRef.current = false;
            }
        } else {
            setTabStates(prev => {
                const curPrevTab = prev[prevTab];
                const next = { ...prev };
                if (curPrevTab && (curPrevTab.loading || curPrevTab.refreshing || curPrevTab.loadingMore)) {
                    next[prevTab] = { ...curPrevTab, loading: false, refreshing: false, loadingMore: false };
                }
                next[tab] = {
                    ...(next[tab] || createInitialTabStates()[DEFAULT_TAB]),
                    loading: true,
                    timeoutError: false,
                };
                return next;
            });
            setActiveTab(tab);
            currentScrollYRef.current = 0;
            requestAnimationFrame(() => {
                flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
            });
            fetchOperators(1, false, tab);
        }
    };

    const handleLoadMore = () => {
        const ts = tabStatesRef.current[activeTabRef.current];
        if (!ts || !ts.hasMore || ts.loading || ts.loadingMore || ts.refreshing || isFetchingRef.current) return;
        if (ts.data.length === 0) return;

        // Prevent unsolicited page=2 fetch on initial launch/tab mount unless content doesn't fill viewport
        if (!hasUserScrolledRef.current) {
            const viewportH = viewportHeightRef.current;
            const contentH = contentHeightRef.current;
            const fillsViewport = viewportH > 0 && contentH > viewportH + 40;
            if (fillsViewport || shortListAutoFetchedRef.current[activeTabRef.current]) {
                return;
            }
            shortListAutoFetchedRef.current[activeTabRef.current] = true;
        }

        fetchOperators(ts.page + 1, false, activeTabRef.current);
    };

    const handleMomentumScrollEnd = (event) => {
        if (!hasUserScrolledRef.current) return;
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        if (contentOffset.y <= 0) return;
        const paddingToBottom = 160;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
            handleLoadMore();
        }
    };

    const renderFooter = () => {
        if (loadingMore) {
            return (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#ec4899" />
                </View>
            );
        }
        if (!hasMore && filteredData.length > 5) {
            return (
                <View style={{ paddingVertical: 30, alignItems: 'center', opacity: 0.5 }}>
                    <Ionicons name="checkmark-done-circle-outline" size={24} color={theme.colors.textSecondary} />
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 }}>Tüm kişileri görüntülediniz</Text>
                </View>
            );
        }
        return <View style={{ height: 20 }} />;
    };

    const handleOpenProfile = React.useCallback((operator) => {
        navigation.navigate('OperatorProfile', { operator, user: userRef.current });
    }, [navigation]);

    const handleOpenChat = React.useCallback((operator) => {
        navigation.navigate('Chat', {
            operatorId: operator.id,
            name: operator.name,
            gender: operator.gender,
            avatar_url: operator.avatar_url,
            vip_level: operator.vip_level || 0,
            user: userRef.current,
        });
    }, [navigation]);

    const handleHiPress = React.useCallback(async (operator) => {
        const currentUser = userRef.current;
        const currentBal = Number(balanceRef.current ?? currentUser?.balance ?? 0);
        if (currentBal < 10) {
            handleInsufficientCoins();
            return false;
        }

        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/messages/send-hi`, {
                senderId: currentUser.id,
                receiverId: operator.id,
                content: 'Merhaba'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                if (res.data.newBalance !== undefined) {
                    const nb = Number(res.data.newBalance);
                    setBalance(nb);
                    useAppStore.getState().setBalance(nb, true);
                    const updatedUser = { ...currentUser, balance: nb };
                    setUser(updatedUser);
                    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
                }
                return true;
            }
            return false;
        } catch (error) {
            if (error.response?.data?.insufficientFunds || (error.response?.status === 400 && error.response?.data?.error?.includes('Yetersiz bakiye'))) {
                handleInsufficientCoins();
            } else {
                console.error('Hi send error:', error);
            }
            return false;
        }
    }, [handleInsufficientCoins]);

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
                onCoinPress={() => navigation.navigate('PurchaseInfo', { user: userRef.current })}
                onExplorePress={() => navigation.navigate('Keşfet')}
                onResellerPress={() => navigation.navigate('OperatorProfile', { operator: { id: 66, user_id: 66, name: 'FS Coin Bayi', display_name: 'FS Coin Bayi' }, user: userRef.current })}
            />
            <ActionCards
                onRewardsPress={() => navigation.navigate('Leaderboard')}
                onInvitePress={() => navigation.navigate('Invite')}
                theme={theme}
            />

            <View style={{ paddingHorizontal: 16 }}>
                <DestinyHero onPress={() => setShowMatchModal(true)} />
            </View>

            {false && <TouchableOpacity
                activeOpacity={0.85}
                style={styles.partyBannerWrapper}
                onPress={() => navigation.navigate('Main', { screen: 'Odalar' })}
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
            </TouchableOpacity>}

            <View style={[styles.tabContainer, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    {DISCOVERY_TABS.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => handleTabPress(tab.id)}
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
                                        {tab.label}
                                    </GradientText>
                                ) : (
                                    <Text style={[
                                        styles.tabText,
                                        styles.inactiveTabText,
                                        {
                                            color: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : '#64748B'
                                        }
                                    ]}>
                                        {tab.label}
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
    ), [theme, showSearch, searchText, activeTab, currentFilters]);


    const userGender = getProfileGender(user);

    const filteredData = React.useMemo(() => {
        const resList = operators.filter(op => {
            const opGender = getProfileGender(op);

            // STRICT GENDER GUARD: If user is male, hide male profiles. If female, hide female profiles.
            if (userGender !== 'coin_bayisi' && opGender === userGender) {
                return false;
            }

            const matchesSearch = normalizeText(op.name).includes(normalizeText(searchText)) ||
                                  normalizeText(op.job || '').includes(normalizeText(searchText));

            let matchesGender = true;
            if (currentFilters.gender !== 'all') {
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
        return resList;
    }, [operators, searchText, currentFilters, userGender]);

    const renderItem = React.useCallback(({ item }) => (
        <OperatorItem
            item={item}
            theme={theme}
            onOpenProfile={handleOpenProfile}
            onOpenChat={handleOpenChat}
            onHiPress={handleHiPress}
        />
    ), [theme, handleOpenProfile, handleOpenChat, handleHiPress]);

    return (
        <LinearGradient
            colors={theme.mode === 'dark' ? theme.gradients.dark : [theme.colors.background, theme.colors.backgroundSecondary]}
            style={styles.container}
        >
            <View style={{ flex: 1 }} pointerEvents={showGenderConfirm ? 'none' : 'auto'}>
            <View style={{ height: Platform.OS === 'ios' ? insets.top : (StatusBar.currentHeight || 24) - 4 }} />
            <FlatList
                ref={flatListRef}
                data={filteredData}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                ListHeaderComponent={headerComponent}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={loading ? (
                    <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="large" color="#ec4899" />
                        <Text style={{ marginTop: 16, color: theme.colors.textSecondary }}>Yükleniyor...</Text>
                    </View>
                ) : timeoutError ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="warning-outline" size={48} color={theme.colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Bağlantı zaman aşımına uğradı.</Text>
                        <TouchableOpacity onPress={() => fetchOperators(1, false, activeTab)} style={{ marginTop: 16, padding: 10, backgroundColor: '#ec4899', borderRadius: 8 }}>
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Tekrar Dene</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="search-outline" size={48} color={theme.colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                            {activeTab === 'online' ? 'Şu an kimse çevrimiçi değil.' : 'Sonuç bulunamadı.'}
                        </Text>
                    </View>
                )}
                contentContainerStyle={{ paddingBottom: 120 }}
                onRefresh={onRefresh}
                refreshing={refreshing}
                scrollEnabled={!showGenderConfirm}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.3}
                onScroll={(e) => {
                    const y = e.nativeEvent.contentOffset.y;
                    currentScrollYRef.current = y;
                    tabScrollOffsetsRef.current[activeTabRef.current] = y;
                }}
                scrollEventThrottle={100}
                onScrollBeginDrag={() => { hasUserScrolledRef.current = true; }}
                onMomentumScrollBegin={() => { hasUserScrolledRef.current = true; }}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                onLayout={(e) => { viewportHeightRef.current = e.nativeEvent.layout.height; }}
                onContentSizeChange={(_, h) => { contentHeightRef.current = h; }}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={5}
                maxToRenderPerBatch={4}
                windowSize={5}
            />
            </View>

            <FilterModal 
                visible={showFilterModal} 
                onClose={() => setShowFilterModal(false)} 
                onApply={(filters) => setCurrentFilters(filters)} 
                currentFilters={currentFilters}
                theme={theme}
            />

            <DestinyMatchModal
                visible={showMatchModal}
                onClose={() => setShowMatchModal(false)}
                operators={filteredData.filter(op => getProfileGender(op) !== 'coin_bayisi')}
                navigation={navigation}
                user={user}
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
    userCard: {
        padding: 16,
        paddingHorizontal: 20,
        minHeight: 120,
        borderRadius: 0,
        backgroundColor: 'transparent',
    },
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
