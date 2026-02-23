import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Dimensions, ScrollView, Alert, TextInput, Modal } from 'react-native';
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
import DestinyMatchModal from '../components/DestinyMatchModal';
import DestinyHero from '../components/DestinyHero';
import GlassCard from '../components/ui/GlassCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import SwipeDeck from '../components/discovery/SwipeDeck';
import HeroSection from '../components/hero/HeroSection';
import PremiumBackground from '../components/animated/PremiumBackground';
import PromotedProfiles from '../components/home/PromotedProfiles';

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

export default function HomeScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { theme, themeMode } = useTheme();
    const { user: routeUser, gender } = route.params || {};
    const TEST_USER_ID = 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b';
    const user = routeUser ? { ...routeUser, name: routeUser.name || routeUser.display_name || routeUser.username || 'Kullanıcı' } : { id: TEST_USER_ID, name: 'Misafir', hearts: 0 };
    const [balance, setBalance] = useState(user.hearts || 0);
    const [operators, setOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [promotedProfiles, setPromotedProfiles] = useState([]);
    const [activeTab, setActiveTab] = useState('Önerilen');
    const [isSwipeMode, setIsSwipeMode] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filterOptions, setFilterOptions] = useState({ gender: 'all', online: false });

    useFocusEffect(
        React.useCallback(() => {
            fetchOperators();
            // Refresh balance if needed
        }, [])
    );

    const fetchOperators = async () => {
        try {
            const token = user?.token || await AsyncStorage.getItem('token');

            if (!token) {
                const res = await axios.get(`${API_URL}/operators?gender=kadin`);
                setOperators(res.data);
                return;
            }

            const res = await axios.get(`${API_URL}/discovery`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            setOperators(res.data);

            // Generate promoted profiles (shuffled subset of operators only)
            if (res.data && res.data.length > 0) {
                // Filtrleme ekleniyor: is_operator flag'i varsa onu kullanıyoruz ya da direkt operators listesinden alıyoruz
                const opOnly = res.data.filter(u => u.is_operator || u.role === 'operator' || true); // Endpoint zaten operatörleri döndürüyor
                const shuffled = [...opOnly].sort(() => Math.random() - 0.5).slice(0, 10);
                setPromotedProfiles(shuffled);
            }
        } catch (error) {
            console.error("Fetch Discovery Error:", error);

            // If 403 Forbidden, token is invalid, clear and redirect
            if (error.response?.status === 401 || error.response?.status === 403) {
                console.warn("[Home] Token invalid detected, clearing session.");
                await AsyncStorage.multiRemove(['token', 'user']);
                navigation.replace('Auth');
                return;
            }

            try {
                const res = await axios.get(`${API_URL}/operators`);
                setOperators(res.data);
            } catch (inner) {
                console.error("Fallback error:", inner);
            }
        } finally {
            setLoading(false);
        }
    };

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

    const handleTabPress = (tab) => {
        if (activeTab === tab) return;

        setActiveTab(tab);
        setLoading(true);
        // Simulate fetch/shuffle
        setTimeout(() => {
            const shuffled = [...operators].sort(() => Math.random() - 0.5);
            setOperators(shuffled);
            setLoading(false);
        }, 200);
    };

    const renderOperator = ({ item }) => (
        <Motion.SlideUp key={item.id}>
            <GlassCard style={styles.userCard} intensity={40}>
                {/* User Card Content (Avatar, info, bio, photos) - Keeping same structure */}
                <View style={styles.cardHeader}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}
                        onPress={() => navigation.navigate('OperatorProfile', { operator: item, user })}
                    >
                        <View style={styles.avatarContainer}>
                            <StoryRing hasNewStory={!!item.has_active_story} size={68} onPress={() => navigation.navigate('OperatorProfile', { operator: item, user })}>
                                <VipFrame level={item.vip_level || 0} avatar={item.avatar_url} size={65} isStatic={true} />
                            </StoryRing>
                            {item.is_online && <View style={styles.onlineBadge} />}
                        </View>
                        <View style={styles.infoContainer}>
                            <View style={styles.nameRow}>
                                <Text
                                    style={[styles.name, { color: theme.colors.text, flexShrink: 1 }]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
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
                            onPress={() => navigation.navigate('Chat', { operatorId: item.id, name: item.name, avatar_url: item.avatar_url, user })}
                            onHiPress={async () => {
                                try {
                                    // Send automatic "Merhaba" message
                                    await axios.post(`${API_URL}/messages/send-hi`, {
                                        userId: user.id,
                                        operatorId: item.id,
                                        content: 'Merhaba 👋'
                                    });
                                    console.log(`[HomeScreen] Sent 'Hi' to ${item.name}`);
                                } catch (e) {
                                    console.error('[HomeScreen] Hi message err', e);
                                }
                            }}
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
                            {item.photos.map((photoUrl, idx) => (
                                <View key={idx} style={styles.albumImageWrapper}>
                                    <Image source={{ uri: photoUrl }} style={[styles.albumImage, { backgroundColor: theme.colors.glass }]} />
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}
            </GlassCard>
        </Motion.SlideUp>
    );

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

    const renderListHeader = () => (
        <View>
            <HeroSection
                onCoinPress={() => navigation.navigate('Vip')}
                onDestinyPress={() => setShowMatchModal(true)}
            />

            <PromotedProfiles
                data={promotedProfiles}
                onProfilePress={(profile) => navigation.navigate('OperatorProfile', { operator: profile, user })}
                user={user}
            />

            {/* Filter Section (Modern Glass) */}
            <View style={{ marginHorizontal: 16, marginBottom: 15, marginTop: 10 }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    {/* Tabs */}
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
                                <Text style={{
                                    fontSize: 13,
                                    fontWeight: '600',
                                    color: activeTab === tab ? 'white' : theme.colors.textSecondary
                                }}>{tab}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Actions */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                            onPress={() => setIsSwipeMode(!isSwipeMode)}
                            style={{
                                width: 38, height: 38, borderRadius: 19,
                                backgroundColor: isSwipeMode ? theme.colors.primary : theme.colors.glass,
                                alignItems: 'center', justifyContent: 'center',
                                borderWidth: 1, borderColor: isSwipeMode ? theme.colors.primary : theme.colors.glassBorder
                            }}>
                            <Ionicons name="albums-outline" size={18} color={isSwipeMode ? 'white' : theme.colors.text} />
                        </TouchableOpacity>
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
                            <Ionicons name="options" size={18} color={(filterOptions.gender !== 'all' || filterOptions.online) ? 'white' : theme.colors.text} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Bar (Collapsible) */}
                {
                    showSearch && (
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
                    )
                }
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Premium Multi-Layered Background for Dark Mode */}
            {themeMode === 'dark' && <PremiumBackground />}

            {isSwipeMode ? (
                <View style={{ flex: 1, marginTop: 20 }}>
                    <SwipeDeck
                        data={filteredOperators}
                        onSwipeRight={async (item) => {
                            try {
                                await axios.post(`${API_URL}/favorites`, { userId: user.id, targetUserId: item.id });
                                console.log(`Liked ${item.name}`);
                            } catch (e) {
                                console.error('Like err', e);
                            }
                        }}
                        onSwipeLeft={(item) => console.log(`Passed ${item.name}`)}
                    />
                </View>
            ) : (
                <FlatList
                    data={filteredOperators}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderOperator}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={renderListHeader()}
                    ListEmptyComponent={
                        loading ? (
                            <View style={{ paddingTop: 10 }}>
                                <SkeletonCard theme={theme} />
                                <SkeletonCard theme={theme} />
                                <SkeletonCard theme={theme} />
                                <SkeletonCard theme={theme} />
                            </View>
                        ) : (
                            <View style={styles.emptyContainer}><Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Sonuç bulunamadı.</Text></View>
                        )
                    }
                />
            )}

            {showMatchModal && (
                <DestinyMatchModal
                    visible={showMatchModal}
                    onClose={() => setShowMatchModal(false)}
                    operators={operators}
                    navigation={navigation}
                    user={user}
                />
            )}

            {/* Filter Modal */}
            <Modal
                visible={showFilterModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowFilterModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <GlassCard style={styles.modalContent} intensity={80} tint="dark">
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Kriterlerini Belirle</Text>
                            <TouchableOpacity onPress={() => setShowFilterModal(false)} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="white" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.filterSection}>
                            <Text style={styles.filterLabel}>Cinsiyet</Text>
                            <View style={styles.filterOptions}>
                                {['all', 'female', 'male'].map((g) => (
                                    <TouchableOpacity
                                        key={g}
                                        style={[styles.filterChip, filterOptions.gender === g && styles.filterChipActive]}
                                        onPress={() => setFilterOptions(prev => ({ ...prev, gender: g }))}
                                    >
                                        <Text style={[styles.filterChipText, filterOptions.gender === g && styles.filterChipTextActive]}>
                                            {g === 'all' ? 'Hepsi' : g === 'female' ? 'Kadın' : 'Erkek'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.filterSection}>
                            <Text style={styles.filterLabel}>Durum</Text>
                            <TouchableOpacity
                                style={[styles.filterChip, filterOptions.online && styles.filterChipActive]}
                                onPress={() => setFilterOptions(prev => ({ ...prev, online: !prev.online }))}
                            >
                                <Ionicons
                                    name={filterOptions.online ? "radio-button-on" : "radio-button-off"}
                                    size={16}
                                    color={filterOptions.online ? "white" : "#64748b"}
                                    style={{ marginRight: 8 }}
                                />
                                <Text style={[styles.filterChipText, filterOptions.online && styles.filterChipTextActive]}>Sadece Online</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.applyButton}
                            onPress={() => setShowFilterModal(false)}
                        >
                            <LinearGradient
                                colors={['#8b5cf6', '#ec4899']}
                                style={styles.applyButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={styles.applyButtonText}>Filtreleri Uygula</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </GlassCard>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    listContent: {
        paddingBottom: 40,
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
        marginBottom: 2,
    },
    name: {
        fontSize: 18,
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
        fontSize: 11,
        fontWeight: 'bold',
        marginLeft: 2,
    },
    jobText: { fontSize: 13, marginTop: 2 },

    // Bio Stilleri
    cardBioContainer: {
        padding: 12,
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
        marginTop: 4,
    },
    albumScroll: {
        paddingRight: 10,
    },
    albumImage: {
        width: 65, // Reduced from 80
        height: 80, // Reduced from 100
        borderRadius: 10,
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
