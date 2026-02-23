import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
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

export default function FavoritesScreen({ navigation, route }) {
    const { theme, themeMode } = useTheme();
    const { user } = route.params || {};
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        React.useCallback(() => {
            if (user?.id) {
                fetchFavorites();
            } else {
                setLoading(false);
            }
        }, [user])
    );

    const fetchFavorites = async () => {
        try {
            const res = await axios.get(`${API_URL}/favorites/${user.id}`);
            setFavorites(res.data);
        } catch (error) {
            console.error('Fetch Favorites Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderFavoriteItem = ({ item, index }) => {
        return (
            <Animated.View
                entering={FadeInDown.delay(index * 50).springify().damping(12)}
                layout={Layout.springify()}
            >
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        // Convert DB format to expected Operator format if needed
                        const operatorData = {
                            id: item.id,
                            user_id: item.id,
                            name: item.username,
                            avatar_url: item.avatar_url,
                            gender: item.gender,
                            job: item.job,
                            vip_level: item.is_vip ? 1 : 0, // Fallback
                            is_online: item.is_online
                        };
                        navigation.navigate('OperatorProfile', { operator: operatorData, user });
                    }}
                    style={{ marginBottom: 12, marginHorizontal: 16 }}
                    activeOpacity={0.8}
                >
                    <GlassCard intensity={20} tint="dark" style={styles.chatItem}>
                        <View style={styles.avatarContainer}>
                            <VipFrame
                                level={item.is_vip ? 1 : 0}
                                avatar={item.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username)}&background=random&color=fff`}
                                size={56}
                                isStatic={true}
                            />
                            {item.is_online && (
                                <View style={[styles.onlineBadge, { borderColor: themeMode === 'dark' ? '#0f172a' : theme.colors.background }]} />
                            )}
                        </View>

                        <View style={styles.content}>
                            <View style={styles.mainContent}>
                                <View style={styles.textContainer}>
                                    <View style={styles.nameRow}>
                                        <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
                                            {item.username}
                                        </Text>

                                        {item.is_vip && (
                                            <LinearGradient
                                                colors={['#e879f9', '#d946ef']}
                                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.vipBadge}
                                            >
                                                <Ionicons name="star" size={8} color="white" />
                                                <Text style={styles.vipText}>VIP</Text>
                                            </LinearGradient>
                                        )}
                                    </View>
                                    <Text style={[styles.lastMsg, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                                        {item.job || (item.gender === 'erkek' ? 'Erkek' : 'Kadın')}
                                    </Text>
                                </View>
                                <View style={styles.metaContainer}>
                                    <View style={styles.heartIconWrapper}>
                                        <Ionicons name="heart" size={20} color="#ef4444" />
                                    </View>
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
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Favorilerim</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={{ paddingTop: 10 }}>
                    {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
                </View>
            ) : favorites.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <AnimatedEmptyState
                        icon="heart-outline"
                        title="Henüz kimse yok"
                        description="Görünüşe göre henüz kimseyi favorilerine eklememişsin. Yeni insanları keşfetmeye başla!"
                        colors={['#ef4444', '#f43f5e']}
                    />
                </View>
            ) : (
                <FlatList
                    data={favorites}
                    renderItem={renderFavoriteItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingVertical: 10, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 60,
        paddingBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptySubText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    chatItem: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 24,
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 16,
    },
    onlineBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#10b981',
        borderWidth: 2,
        zIndex: 2,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
    },
    mainContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    vipBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 2,
    },
    vipText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    lastMsg: {
        fontSize: 14,
        paddingRight: 16,
    },
    metaContainer: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        marginLeft: 8,
    },
    heartIconWrapper: {
        padding: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 16,
    }
});
