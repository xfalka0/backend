import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
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

export default function MessagesScreen({ navigation, route }) {
    const insets = useSafeAreaInsets();
    const { theme, themeMode } = useTheme();
    const { user } = route.params || {};
    const [searchText, setSearchText] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        React.useCallback(() => {
            if (user?.id) {
                fetchChats();
            } else {
                console.log('MessagesScreen: No user ID, stop loading');
                setLoading(false);
            }
        }, [user])
    );

    const fetchChats = async () => {
        try {
            const res = await axios.get(`${API_URL}/users/${user.id}/chats`);
            setChats(res.data);
        } catch (error) {
            console.error('Fetch Chats Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredChats = React.useMemo(() => {
        if (!searchText) return chats;
        return chats.filter(chat =>
            chat.name.toLowerCase().includes(searchText.toLowerCase())
        );
    }, [chats, searchText]);

    const renderChatItem = ({ item, index }) => {
        const hasUnread = item.unread_count > 0;

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
                            avatar_url: item.avatar_url,
                            user
                        });
                    }}
                    style={{ marginBottom: 12, marginHorizontal: 16 }}
                    activeOpacity={0.8}
                >
                    <GlassCard
                        intensity={hasUnread ? 40 : 20}
                        tint={themeMode === 'dark' ? 'dark' : 'light'}
                        style={[
                            styles.chatItem,
                            hasUnread && { borderColor: 'rgba(236, 72, 153, 0.5)', borderWidth: 1 }
                        ]}
                    >
                        <View style={styles.avatarContainer}>
                            <VipFrame
                                level={item.vip_level || 0}
                                avatar={item.avatar_url}
                                size={56}
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
                                        {item.last_message || 'Sohbet Başladı 💬'}
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

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {themeMode === 'dark' && (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    <LinearGradient
                        colors={['#030712', '#0f172a']}
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
                    ListHeaderComponent={(
                        <>
                            <View style={{ height: insets.top + 10 }} />
                            <PremiumCoinCard onPress={() => navigation.navigate('Shop')} />
                            <View style={styles.headerContainer}>
                                <Text style={[styles.title, { color: theme.colors.text }]}>Sohbetler</Text>
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
        paddingBottom: 40,
        paddingTop: 10,
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 16,
        borderRadius: 24,
        // Premium Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 6,
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
        fontSize: 17,
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
        fontSize: 14,
    },
    time: {
        fontSize: 12,
        marginBottom: 6, // Space between time and badge
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
