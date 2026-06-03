import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import Animated, {
    FadeInDown,
    Layout,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    Easing
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { API_URL } from '../config';
import VipFrame from '../components/ui/VipFrame';
import GlassCard from '../components/ui/GlassCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import AnimatedEmptyState from '../components/ui/AnimatedEmptyState';
import PremiumCoinCard from '../components/hero/PremiumCoinCard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OnlinePulse = ({ themeMode, theme }) => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.8);

    useEffect(() => {
        scale.value = withRepeat(
            withSequence(
                withTiming(1.2, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
                withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0.8, { duration: 1000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View style={[
            styles.onlineBadge,
            { borderColor: themeMode === 'dark' ? '#0f172a' : theme.colors.background },
            animatedStyle
        ]} />
    );
};

import { useChat } from '../contexts/ChatContext';

export default function MessagesScreen({ navigation, route }) {
    const { fetchUnreadCount, balance, fetchBalance, user: contextUser } = useChat();
    const user = contextUser || route.params?.user || {};
    
    console.log('[MessagesScreen] Current balance:', balance);
    console.log('[MessagesScreen] User ID:', user?.id);

    const insets = useSafeAreaInsets();
    const { theme, themeMode } = useTheme();
    const [searchText, setSearchText] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [pendingInvitations, setPendingInvitations] = useState([]);

    useFocusEffect(
        React.useCallback(() => {
            if (user?.id) {
                fetchChats(0, true);
                fetchUnreadCount(user.id);
                fetchBalance(user.id);
                fetchInvitations();
            } else {
                setLoading(false);
            }
        }, [user?.id])
    );

    const fetchInvitations = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;
            const inviteRes = await axios.get(`${API_URL}/agency/my-invitations`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (inviteRes.data) {
                setPendingInvitations(inviteRes.data);
            }
        } catch (error) {
            console.log('Error fetching pending invitations in MessagesScreen:', error.message);
        }
    };

    const handleAcceptInvitation = async (inviteId) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const res = await axios.post(`${API_URL}/agency/invitations/${inviteId}/accept`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data && res.data.success) {
                Alert.alert('Başarılı', res.data.message || 'Ajans davetini başarıyla kabul ettiniz!');
                setPendingInvitations(prev => prev.filter(inv => inv.id !== inviteId));
                fetchChats(0, true);
            } else {
                Alert.alert('Hata', res.data?.error || 'Davet kabul edilemedi.');
            }
        } catch (error) {
            console.error('[MessagesScreen] Accept invite error:', error);
            const errMsg = error.response?.data?.error || 'Davet kabul edilirken bir hata oluştu.';
            Alert.alert('Hata', errMsg);
        }
    };

    const handleRejectInvitation = async (inviteId) => {
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const res = await axios.post(`${API_URL}/agency/invitations/${inviteId}/reject`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data && res.data.success) {
                Alert.alert('Başarılı', 'Ajans davetini reddettiniz.');
                setPendingInvitations(prev => prev.filter(inv => inv.id !== inviteId));
            } else {
                Alert.alert('Hata', res.data?.error || 'Davet reddedilemedi.');
            }
        } catch (error) {
            console.error('[MessagesScreen] Reject invite error:', error);
            const errMsg = error.response?.data?.error || 'Davet reddedilirken bir hata oluştu.';
            Alert.alert('Hata', errMsg);
        }
    };

    const fetchChats = async (pageNum = 0, isRefresh = false) => {
        if (!isRefresh && !hasMore) return;

        try {
            if (isRefresh) {
                // Keep the current chats but show loading indicator if desired, or just silent refresh.
                // setLoading(true); is omitted here to avoid skeleton flashing on every focus
            } else if (pageNum > 0) {
                setLoadingMore(true);
            }
            
            const limit = 10;
            const res = await axios.get(`${API_URL}/users/${user.id}/chats?limit=${limit}&offset=${pageNum * limit}`);
            
            if (res.data.length < limit) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }

            if (isRefresh || pageNum === 0) {
                setChats(res.data);
            } else {
                setChats(prev => {
                    const newItems = res.data.filter(newItem => !prev.some(existing => existing.id === newItem.id));
                    return [...prev, ...newItems];
                });
            }
            setPage(pageNum);
        } catch (error) {
            console.error('Fetch Chats Error:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const filteredChats = React.useMemo(() => {
        let result = searchText 
            ? chats.filter(chat => chat.name.toLowerCase().includes(searchText.toLowerCase()))
            : [...chats];

        // Sort: Strictly by date (Newest First) - with NaN protection
        return [...result].sort((a, b) => {
            const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            
            // Handle invalid dates
            const finalA = isNaN(timeA) ? 0 : timeA;
            const finalB = isNaN(timeB) ? 0 : timeB;
            
            return finalB - finalA;
        });
    }, [chats, searchText]);

    const renderChatItem = ({ item, index }) => {
        const hasUnread = item.unread_count > 0;
        const formatLastMessage = (msg, type) => {
            if (!msg) return 'Sohbet Başladı 💬';
            
            // If it's a URL (Image or Audio)
            if (msg.startsWith('http')) {
                if (msg.includes('image') || msg.includes('cloudinary') || msg.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
                    return '📷 Fotoğraf';
                }
                if (msg.includes('audio') || msg.match(/\.(m4a|mp3|wav|ogg)/i)) {
                    return '🎤 Ses Mesajı';
                }
            }
            
            // Check by type if available (some backends send type)
            if (type === 'image') return '📷 Fotoğraf';
            if (type === 'audio') return '🎤 Ses Mesajı';
            if (type === 'gift') return '🎁 Hediye';
            
            return msg;
        };

        return (
            <Animated.View
                entering={FadeInDown.delay(index * 100).springify().damping(12)}
                layout={Layout.springify()}
            >
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        navigation.navigate('Chat', {
                            operatorId: item.operator_id,
                            chatId: item.id,
                            name: item.name,
                            gender: item.gender,
                            avatar_url: item.avatar_url,
                            user
                        });
                    }}
                    style={{ marginBottom: 12, marginHorizontal: 16 }}
                    activeOpacity={0.8}
                >
                    <GlassCard
                        intensity={hasUnread ? 50 : 35}
                        tint={themeMode === 'dark' ? 'dark' : 'light'}
                        style={[
                            styles.chatItem,
                            hasUnread 
                                ? { borderColor: 'rgba(236, 72, 153, 0.5)', borderWidth: 1.5 }
                                : { borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1 }
                        ]}
                    >
                        <View style={styles.avatarContainer}>
                            <VipFrame
                                level={item.gender === 'coin_bayisi' ? 'dealer' : (item.vip_level || 0)}
                                avatar={item.avatar_url}
                                size={48} // Reduced from 56
                                isStatic={true}
                            />
                            {item.is_online && (
                                <OnlinePulse themeMode={themeMode} theme={theme} />
                            )}
                        </View>
 
                        <View style={styles.content}>
                            <View style={styles.mainContent}>
                                <View style={styles.textContainer}>
                                    <View style={styles.nameRow}>
                                        <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
                                            {item.name}
                                        </Text>
 
                                        {item.vip_level > 0 && (
                                            <LinearGradient
                                                colors={
                                                    item.vip_level >= 6 ? ['#1a1a1b', '#000000'] :
                                                        item.vip_level >= 5 ? ['#e879f9', '#d946ef'] :
                                                            (item.vip_level >= 3 ? ['#fbbf24', '#d97706'] : ['#8b5cf6', '#6366f1'])
                                                }
                                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.vipBadge}
                                            >
                                                <Ionicons name="star" size={8} color="white" />
                                                <Text style={styles.vipText}>VIP {item.vip_level}</Text>
                                            </LinearGradient>
                                        )}
                                        <Ionicons name="checkmark-circle" size={14} color="#3b82f6" />
                                    </View>
                                    <Text
                                        style={[
                                            styles.lastMsg,
                                            {
                                                color: hasUnread ? theme.colors.text : theme.colors.textSecondary,
                                                fontWeight: hasUnread ? '700' : '400',
                                            }
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {formatLastMessage(item.last_message, item.last_message_type)}
                                    </Text>
                                </View>

                                <View style={styles.metaContainer}>
                                    <Text style={[
                                        styles.time,
                                        {
                                            color: hasUnread ? theme.colors.primary : theme.colors.textSecondary,
                                            opacity: hasUnread ? 1 : 0.6
                                        }
                                    ]}>
                                        {item.last_message_at ? new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </Text>
                                    {hasUnread && (
                                        <LinearGradient
                                            colors={['#ec4899', '#8b5cf6']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.unreadBadge}
                                        >
                                            <Text style={styles.unreadText}>{item.unread_count}</Text>
                                        </LinearGradient>
                                    )}
                                </View>
                            </View>
                        </View>
                    </GlassCard>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const renderInvitationItem = (invite, index) => {
        return (
            <Animated.View
                entering={FadeInDown.delay(index * 100).springify().damping(12)}
                layout={Layout.springify()}
                key={`invite-${invite.id}`}
            >
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        navigation.navigate('Chat', {
                            operatorId: invite.owner_id,
                            chatId: null,
                            name: invite.owner_name || invite.owner_username || 'Ajans Sahibi',
                            avatar_url: invite.owner_avatar,
                            user
                        });
                    }}
                    style={{ marginBottom: 12, marginHorizontal: 16 }}
                    activeOpacity={0.8}
                >
                    <GlassCard
                        intensity={45}
                        tint={themeMode === 'dark' ? 'dark' : 'light'}
                        style={[
                            styles.chatItem,
                            { borderColor: 'rgba(236, 72, 153, 0.4)', borderWidth: 1.5 }
                        ]}
                    >
                        <View style={styles.avatarContainer}>
                            <VipFrame
                                level={0}
                                avatar={invite.owner_avatar || 'https://via.placeholder.com/150'}
                                size={48}
                                isStatic={true}
                            />
                            <View style={[styles.onlineBadge, { backgroundColor: '#ec4899', width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }]}>
                                <Ionicons name="flash" size={8} color="white" />
                            </View>
                        </View>

                        <View style={styles.content}>
                            <View style={styles.mainContent}>
                                <View style={styles.textContainer}>
                                    <View style={styles.nameRow}>
                                        <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
                                            {invite.owner_name || invite.owner_username || 'Ajans Sahibi'}
                                        </Text>
                                        <LinearGradient
                                            colors={['#ec4899', '#8b5cf6']}
                                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                            style={[styles.vipBadge, { marginLeft: 6 }]}
                                        >
                                            <Text style={styles.vipText}>AJANS DAVETİ</Text>
                                        </LinearGradient>
                                    </View>
                                    <Text
                                        style={[
                                            styles.lastMsg,
                                            {
                                                color: theme.colors.text,
                                                fontWeight: '500',
                                            }
                                        ]}
                                    >
                                        <Text style={{ fontWeight: 'bold', color: '#ec4899' }}>{invite.agency_name}</Text> ajansına katılmanız için davet gönderdi.
                                    </Text>
                                </View>
                                <View style={styles.metaContainer}>
                                    <Text style={[styles.time, { color: theme.colors.textSecondary, opacity: 0.6 }]}>
                                        {invite.created_at ? new Date(invite.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </GlassCard>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {themeMode === 'dark' && (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    <LinearGradient
                        colors={theme.gradients.dark}
                        style={StyleSheet.absoluteFill}
                    />
                </View>
            )}

            {loading ? (
                <View style={{ paddingTop: 40 }}>
                    {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
                </View>
            ) : (
                <FlatList
                    data={filteredChats}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderChatItem}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    onEndReached={() => {
                        if (!loadingMore && hasMore && !searchText) {
                            fetchChats(page + 1);
                        }
                    }}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color={theme.colors.primary} />
                            </View>
                        ) : null
                    }
                    ListHeaderComponent={(
                        <>
                            <View style={{ height: insets.top + 10 }} />
                            <PremiumCoinCard
                                onCoinPress={() => navigation.navigate('Shop')}
                                onExplorePress={() => navigation.navigate('Keşfet')}
                                onResellerPress={() => navigation.navigate('PurchaseInfo', { user })}
                            />
                            
                            <View style={[styles.headerContainer, { zIndex: 100 }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                    <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>Sohbetler</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setShowSearch(!showSearch)}
                                    style={{
                                        padding: 8,
                                        borderRadius: 20,
                                        backgroundColor: showSearch ? 'rgba(139, 92, 246, 0.2)' : 'transparent'
                                    }}
                                >
                                    <Ionicons name="search-outline" size={24} color={showSearch ? '#8b5cf6' : theme.colors.text} />
                                </TouchableOpacity>
                            </View>

                            {/* Search Bar */}
                            {showSearch && (
                                <View style={{ paddingHorizontal: 20, marginBottom: 15 }}>
                                    <View style={{
                                        flexDirection: 'row', alignItems: 'center',
                                        backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                        borderRadius: 12, paddingHorizontal: 12, height: 46
                                    }}>
                                        <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={{ marginRight: 10 }} />
                                        <TextInput
                                            placeholder="Sohbetlerde ara..."
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
                            )}

                            {/* Pending Agency Invitations */}
                            {pendingInvitations && pendingInvitations.length > 0 && (
                                <View style={{ marginBottom: 15 }}>
                                    {pendingInvitations.map((invite, index) => renderInvitationItem(invite, index))}
                                </View>
                            )}
                        </>
                    )}
                    ListEmptyComponent={!loading && (
                        <AnimatedEmptyState
                            icon="chatbubble-ellipses-outline"
                            title="Sohbet Kutusu Boş"
                            description="Henüz kimseyle mesajlaşmadın. Keşfet sekmesinden yeni insanlarla tanışmaya başla!"
                            colors={['#ec4899', '#8b5cf6']}
                        />
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: 10,
        marginBottom: 15,
    },
    title: {
        fontSize: 28,
        fontWeight: '700', // One step thinner
        letterSpacing: -0.5,
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    list: {
        paddingBottom: 130,
        paddingTop: 10,
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        overflow: 'hidden',
        // Premium Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 0,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 16,
    },
    onlineBadge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#10b981',
        borderWidth: 2,
        zIndex: 999,
        elevation: 999,
    },
    unreadBadge: {
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
        marginTop: 6,
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 4,
    },
    unreadText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '900',
    },
    content: {
        flex: 1,
    },
    mainContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start', // Align to top
    },
    textContainer: {
        flex: 1,
        marginRight: 10,
    },
    metaContainer: {
        alignItems: 'flex-end', // Right align time and badge
        justifyContent: 'flex-start',
    },
    name: {
        fontSize: 15, // Reduced from 17
        fontWeight: 'bold',
        marginRight: 4,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    vipBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginRight: 6,
    },
    vipText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '900',
        marginLeft: 2,
    },
    verifiedBadgeIcon: {
        marginLeft: 2,
    },
    lastMsg: {
        fontSize: 12, // Reduced from 14
    },
    time: {
        fontSize: 10, // Reduced from 12
        marginBottom: 6, // Space between time and badge
        fontWeight: '600',
    },
    coinBadge: {
        marginLeft: 12,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#fbbf24',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    coinGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    coinText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '900',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
