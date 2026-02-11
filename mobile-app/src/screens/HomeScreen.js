import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Dimensions, ScrollView, Alert } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';
import { API_URL, SOCKET_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { Motion } from '../components/motion/MotionSystem';
import VipFrame from '../components/ui/VipFrame';
import HiButton from '../components/ui/HiButton';
import PromoBanner from '../components/ui/PromoBanner';
import StoryRing from '../components/animated/StoryRing';

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
    const { useFocusEffect } = require('@react-navigation/native');

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

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
                {TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
                    >
                        <Text style={[
                            styles.tabText,
                            { color: theme.colors.textSecondary },
                            activeTab === tab && { color: theme.colors.text }
                        ]}>{tab}</Text>
                        {activeTab === tab && <View style={[styles.activeIndicator, { backgroundColor: theme.gradients.primary[0] }]} />}
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    const renderOperator = ({ item }) => (
        <Motion.SlideUp>
            <View style={[styles.userCard, { backgroundColor: theme.colors.glass, borderColor: theme.colors.glassBorder }]}>
                <View style={styles.cardHeader}>
                    <TouchableOpacity
                        activeOpacity={0.7}
                        style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}
                        onPress={() => navigation.navigate('OperatorProfile', { operator: item, user })}
                    >
                        <View style={styles.avatarContainer}>
                            <StoryRing hasNewStory={!!item.has_active_story} size={68} onPress={() => {
                                if (item.has_active_story) {
                                    // We'd ideally fetch the story here, but for now navigate to profile or attempt to pass simplified story
                                    navigation.navigate('OperatorProfile', { operator: item, user });
                                } else {
                                    navigation.navigate('OperatorProfile', { operator: item, user });
                                }
                            }}>
                                <VipFrame
                                    level={item.vip_level || 0}
                                    avatar={item.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random&color=fff`}
                                    size={65}
                                    isStatic={true}
                                />
                            </StoryRing>
                            {item.is_online && <View style={styles.onlineBadge} />}
                        </View>
                        <View style={styles.infoContainer}>
                            <View style={styles.nameRow}>
                                <Text style={[styles.name, { color: theme.colors.text }]}>{item.name}</Text>
                                {item.vip_level > 0 && (
                                    <LinearGradient
                                        colors={
                                            item.vip_level === 1 ? ['#94a3b8', '#64748b'] :
                                                item.vip_level === 2 ? ['#3b82f6', '#8b5cf6'] :
                                                    item.vip_level === 3 ? ['#a855f7', '#ec4899'] :
                                                        item.vip_level === 4 ? ['#fbbf24', '#7c3aed'] :
                                                            item.vip_level === 5 ? ['#fbbf24', '#ff00ff'] :
                                                                item.vip_level >= 6 ? ['#1a1a1b', '#000000'] :
                                                                    ['#000000', '#1a1a1a']
                                        }
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.premiumVipBadge}
                                    >
                                        <Ionicons name="star" size={10} color={item.vip_level >= 4 ? "#fff" : "#fbbf24"} />
                                        <Text style={styles.premiumVipText}>VIP {item.vip_level}</Text>
                                    </LinearGradient>
                                )}
                                <View style={styles.verifiedBadge}>
                                    <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
                                </View>
                            </View>
                            {/* VIP Badge Removed - Frame now handles it */}

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <Text style={[styles.jobText, { color: theme.colors.textSecondary }]} numberOfLines={1}>{item.job || 'Öğrenci'}</Text>
                                {item.age && (
                                    <View style={[
                                        styles.ageBadge,
                                        { backgroundColor: item.gender === 'erkek' ? '#3b82f6' : '#f472b6' }
                                    ]}>
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
                            onHiPress={async () => {
                                try {
                                    if (user && user.id) {
                                        console.log('[HiButton] Fetching chat for user:', user.id, 'and operator:', item.id);
                                        const chatRes = await axios.post(`${API_URL}/chats`, {
                                            userId: user.id,
                                            operatorId: item.id
                                        });

                                        const chatId = chatRes.data?.id;
                                        console.log('[HiButton] Chat ID received:', chatId);

                                        if (chatId) {
                                            const socket = io(SOCKET_URL, {
                                                transports: ['websocket'],
                                                reconnectionAttempts: 5
                                            });

                                            socket.on('connect', () => {
                                                console.log('[HiButton] Socket connected. Sending message...');
                                                socket.emit('join_room', chatId);

                                                socket.emit('send_message', {
                                                    chatId: chatId,
                                                    senderId: user.id,
                                                    content: 'Merhaba',
                                                    type: 'text'
                                                });

                                                // Give it a moment to send before disconnecting
                                                setTimeout(() => {
                                                    console.log('[HiButton] Disconnecting socket.');
                                                    socket.disconnect();
                                                }, 2000);
                                            });

                                            socket.on('connect_error', (err) => {
                                                console.error('[HiButton] Socket connection error:', err);
                                            });
                                        }
                                    }
                                } catch (e) {
                                    console.error('[HiButton] Error in onHiPress:', e.message);
                                }
                            }}
                            onPress={() => navigation.navigate('Chat', {
                                operatorId: item.id,
                                name: item.name,
                                avatar_url: item.avatar_url,
                                is_online: item.is_online,
                                vip_level: item.vip_level,
                                user: user
                            })}
                        />
                    </View>
                </View>

                {/* Bio / Hakkında Bölümü */}
                {
                    item.bio && (
                        <View style={[styles.cardBioContainer, { backgroundColor: themeMode === 'dark' ? 'rgba(15, 23, 42, 0.4)' : 'rgba(15, 23, 42, 0.05)' }]}>
                            <Text style={[styles.cardBioBody, { color: theme.colors.textSecondary }]} numberOfLines={3}>
                                {item.bio}
                            </Text>
                        </View>
                    )
                }

                {/* Fotoğraf Albümü (Mini Galeri) */}
                {
                    item.photos && item.photos.length > 0 && (
                        <View style={styles.albumContainer}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.albumScroll}
                            >
                                {item.photos.map((photoUrl, idx) => (
                                    <View key={idx} style={styles.albumImageWrapper}>
                                        <Image
                                            source={{ uri: photoUrl }}
                                            style={[styles.albumImage, { backgroundColor: theme.colors.glass }]}
                                        />
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    )
                }
            </View >
        </Motion.SlideUp >
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Background handles itself via background color in light mode */}
            {themeMode === 'dark' && (
                <LinearGradient colors={['#0f172a', '#1e1b4b', '#0f172a']} style={styles.background} />
            )}

            <FlatList
                data={operators}
                keyExtractor={item => item.id.toString()}
                renderItem={renderOperator}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={(
                    <>
                        <View style={{ height: 10 }} />
                        <PromoBanner navigation={navigation} />
                        {renderHeader()}
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Senin İçin Seçtiklerimiz</Text>
                    </>
                )}
                ListEmptyComponent={
                    loading ? (
                        <View style={styles.emptyContainer}><Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Yükleniyor...</Text></View>
                    ) : (
                        <View style={styles.emptyContainer}><Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Kimse bulunamadı.</Text></View>
                    )
                }
            />
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
