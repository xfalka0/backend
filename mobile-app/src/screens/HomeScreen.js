
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
import DestinyMatchModal from '../components/DestinyMatchModal';
import DestinyHero from '../components/DestinyHero';

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

const TABS = ['Önerilen', 'Yeni', 'Popüler'];

export default function HomeScreen({ navigation, route }) {
    const { theme, themeMode } = useTheme();
    const { user: routeUser, gender } = route.params || {};
    const TEST_USER_ID = 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b';
    const user = routeUser ? { ...routeUser, name: routeUser.name || routeUser.display_name || routeUser.username || 'Kullanıcı' } : { id: TEST_USER_ID, name: 'Misafir', hearts: 0 };
    const [operators, setOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Önerilen');

    useFocusEffect(
        React.useCallback(() => {
            fetchOperators();
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

    const renderDestinyBanner = () => (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowMatchModal(true)}
            style={{ marginHorizontal: 20, marginBottom: 25 }}
        >
            <LinearGradient
                colors={['#2e1065', '#4c1d95', '#ec4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    borderRadius: 28,
                    padding: 3,
                    elevation: 10,
                    shadowColor: '#ec4899',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.4,
                    shadowRadius: 15,
                }}
            >
                <View style={{
                    backgroundColor: '#1e1b4b',
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
                            color: '#ec4899',
                            fontWeight: '900',
                            fontSize: 11,
                            letterSpacing: 2,
                            marginBottom: 8,
                            textTransform: 'uppercase'
                        }}>
                            PREMIUM EŞLEŞME
                        </Text>
                        <Text style={{
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: 22,
                            marginBottom: 6,
                            lineHeight: 28
                        }}>
                            Eşleşmeni Bul
                        </Text>
                        <Text style={{
                            color: '#e2e8f0',
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



    const [searchText, setSearchText] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filterOptions, setFilterOptions] = useState({ gender: 'all', online: false });

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
            <View style={[styles.userCard, { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder }]}>
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
                                <Text style={[styles.name, { color: theme.colors.text }]}>{item.name}</Text>
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
                        <HiButton operatorId={item.id} onPress={() => navigation.navigate('Chat', { operatorId: item.id, name: item.name, avatar_url: item.avatar_url, user })} />
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
            </View>
        </Motion.SlideUp>
    );

    const renderListHeader = () => (
        <>
            <View style={{ height: 10 }} />
            <PromoBanner navigation={navigation} />
            <DestinyHero onPress={() => setShowMatchModal(true)} />

            {/* Filter Section */}
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
                                    backgroundColor: activeTab === tab ? '#8b5cf6' : 'rgba(255,255,255,0.05)',
                                    borderWidth: 1,
                                    borderColor: activeTab === tab ? '#8b5cf6' : 'rgba(255,255,255,0.1)'
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
                            onPress={() => setShowSearch(!showSearch)}
                            style={{
                                width: 38, height: 38, borderRadius: 19,
                                backgroundColor: showSearch ? '#8b5cf6' : 'rgba(255,255,255,0.05)',
                                alignItems: 'center', justifyContent: 'center',
                                borderWidth: 1, borderColor: showSearch ? '#8b5cf6' : 'rgba(255,255,255,0.1)'
                            }}>
                            <Ionicons name="search" size={18} color={showSearch ? 'white' : theme.colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowFilterModal(true)}
                            style={{
                                width: 38, height: 38, borderRadius: 19,
                                backgroundColor: (filterOptions.gender !== 'all' || filterOptions.online) ? '#8b5cf6' : 'rgba(255,255,255,0.05)',
                                alignItems: 'center', justifyContent: 'center',
                                borderWidth: 1, borderColor: (filterOptions.gender !== 'all' || filterOptions.online) ? '#8b5cf6' : 'rgba(255,255,255,0.1)'
                            }}>
                            <Ionicons name="options" size={18} color={(filterOptions.gender !== 'all' || filterOptions.online) ? 'white' : theme.colors.text} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Bar (Collapsible) */}
                {showSearch && (
                    <Motion.SlideUp>
                        <View style={{ marginTop: 15 }}>
                            <View style={{
                                flexDirection: 'row', alignItems: 'center',
                                backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
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
        </>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Background handles itself via background color in light mode */}
            {themeMode === 'dark' && (
                <LinearGradient colors={['#0f172a', '#1e1b4b', '#0f172a']} style={styles.background} />
            )}

            <FlatList
                data={filteredOperators}
                keyExtractor={item => item.id.toString()}
                renderItem={renderOperator}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={renderListHeader()}
                ListEmptyComponent={
                    loading ? (
                        <View style={styles.emptyContainer}><Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Yükleniyor...</Text></View>
                    ) : (
                        <View style={styles.emptyContainer}><Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Sonuç bulunamadı.</Text></View>
                    )
                }
            />

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
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowFilterModal(false)} />
                    <View style={{ backgroundColor: theme.colors.backgroundSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
                        <View style={{ width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.text, marginBottom: 20 }}>Filtrele</Text>

                        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 12 }}>Cinsiyet</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                            {[{ label: 'Tümü', value: 'all' }, { label: 'Kadın', value: 'female' }, { label: 'Erkek', value: 'male' }].map(opt => (
                                <TouchableOpacity
                                    key={opt.value}
                                    onPress={() => setFilterOptions(prev => ({ ...prev, gender: opt.value }))}
                                    style={{
                                        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                                        backgroundColor: filterOptions.gender === opt.value ? '#8b5cf6' : 'rgba(255,255,255,0.05)',
                                        borderWidth: 1, borderColor: filterOptions.gender === opt.value ? '#8b5cf6' : 'rgba(255,255,255,0.1)'
                                    }}
                                >
                                    <Text style={{ color: filterOptions.gender === opt.value ? 'white' : theme.colors.textSecondary, fontWeight: '600' }}>{opt.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 12 }}>Durum</Text>
                        <TouchableOpacity
                            onPress={() => setFilterOptions(prev => ({ ...prev, online: !prev.online }))}
                            style={{
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                padding: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)',
                                borderWidth: 1, borderColor: filterOptions.online ? '#10b981' : 'rgba(255,255,255,0.1)'
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', marginRight: 10 }} />
                                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Sadece Online Olanlar</Text>
                            </View>
                            <Ionicons name={filterOptions.online ? "checkmark-circle" : "ellipse-outline"} size={24} color={filterOptions.online ? "#10b981" : theme.colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setShowFilterModal(false)}
                            style={{ marginTop: 30, backgroundColor: '#8b5cf6', paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
                        >
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Uygula</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { ...StyleSheet.absoluteFillObject },
    listContent: {
        paddingBottom: 100,
        paddingTop: 15, // En üstteki boşluğu minimize ettik
    },
    headerContainer: { paddingHorizontal: 20, marginBottom: 15, marginTop: 10 },
    topBar: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 20 },
    logoText: { fontSize: 26, fontWeight: '900', color: 'white' },
    logoDot: { color: '#d946ef' },
    coinBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
    coinText: { color: 'white', fontWeight: 'bold', marginLeft: 6 },
    tabScroll: { marginBottom: 10 },
    tabButton: { marginRight: 25, alignItems: 'center' },
    tabText: { color: '#64748b', fontSize: 16, fontWeight: '700' },
    activeTabText: { color: 'white' },
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
    sectionTitle: { color: 'white', fontSize: 18, fontWeight: '800', marginHorizontal: 20, marginBottom: 15, marginTop: 10 },
    userCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 28,
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarContainer: { position: 'relative' },
    avatar: { width: 65, height: 65, borderRadius: 22 },
    onlineBadge: { position: 'absolute', right: -4, bottom: -4, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10b981', borderWidth: 2, zIndex: 100 },
    infoContainer: { flex: 1, marginLeft: 18 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    name: { color: 'white', fontSize: 17, fontWeight: '800' },
    verifiedBadge: {
        marginLeft: 8,
    },
    ageBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 12, marginLeft: 8 },
    ageBadgeText: { color: 'white', fontSize: 10, fontWeight: '900', marginLeft: 4 },
    premiumVipBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12, // Soft edges
        marginLeft: 8,
        gap: 3,
    },
    premiumVipText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    jobText: { color: '#94a3b8', fontSize: 13, marginTop: 2 },

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
        color: '#cbd5e1',
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
    emptyText: { color: '#64748b' }
});
