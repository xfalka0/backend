import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';
import { API_URL } from '../config';
import VipFrame from '../components/ui/VipFrame';
import GlassCard from '../components/ui/GlassCard';
import SkeletonCard from '../components/ui/SkeletonCard';

export default function WhoFavoritedMeScreen({ navigation, route }) {
    const { theme, themeMode } = useTheme();
    const { user } = route.params || {};
    const [fans, setFans] = useState([]);
    const [isVIP, setIsVIP] = useState(false);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        React.useCallback(() => {
            if (user?.id) {
                fetchFans();
            } else {
                setLoading(false);
            }
        }, [user])
    );

    const fetchFans = async () => {
        try {
            const res = await axios.get(`${API_URL}/favorites/${user.id}/fans`);
            setIsVIP(res.data.isVIP);
            setFans(res.data.fans);
        } catch (error) {
            console.error('Fetch Fans Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderFanItem = ({ item, index }) => {
        return (
            <Animated.View
                entering={FadeInDown.delay(index * 50).springify().damping(12)}
                layout={Layout.springify()}
            >
                <TouchableOpacity
                    onPress={() => {
                        if (!isVIP) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            navigation.navigate('VipDetails', { user });
                            return;
                        }
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const operatorData = {
                            id: item.id,
                            user_id: item.id,
                            name: item.username,
                            avatar_url: item.avatar_url,
                            gender: item.gender,
                            job: item.job,
                            vip_level: item.is_vip ? 1 : 0,
                            is_online: item.is_online
                        };
                        navigation.navigate('OperatorProfile', { operator: operatorData, user });
                    }}
                    style={{ marginBottom: 12, marginHorizontal: 16 }}
                    activeOpacity={0.8}
                >
                    <GlassCard intensity={20} tint="dark" style={styles.chatItem}>
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatarWrapper}>
                                <VipFrame
                                    level={0}
                                    avatar={item.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username)}&background=random&color=fff`}
                                    size={56}
                                    isStatic={true}
                                />
                                {item.is_blurred && (
                                    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
                                )}
                            </View>
                            {item.is_online && !item.is_blurred && (
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

                                        {!isVIP && item.is_blurred && (
                                            <Ionicons name="lock-closed" size={14} color={theme.colors.textSecondary} style={{ marginLeft: 4 }} />
                                        )}
                                    </View>
                                    <Text style={[styles.lastMsg, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                                        {item.is_blurred ? 'Seni favoriledi' : (item.gender === 'erkek' ? 'Erkek' : 'Kadın')}
                                    </Text>
                                </View>
                                <View style={styles.metaContainer}>
                                    <Text style={[styles.time, { color: theme.colors.textSecondary }]}>
                                        {new Date(item.created_at).toLocaleDateString()}
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
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Beni Favorileyenler</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={{ paddingTop: 10 }}>
                    {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
                </View>
            ) : fans.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Ionicons name="star-outline" size={64} color={theme.colors.border} style={{ marginBottom: 16 }} />
                    <Text style={[styles.emptyText, { color: theme.colors.text }]}>Henüz seni favorileyen olmadı.</Text>
                    <Text style={[styles.emptySubText, { color: theme.colors.textSecondary }]}>Profilini daha fazla öne çıkararak dikkat çekebilirsin!</Text>
                </View>
            ) : (
                <>
                    <FlatList
                        data={fans}
                        renderItem={renderFanItem}
                        keyExtractor={item => item.id + item.created_at}
                        contentContainerStyle={{ paddingVertical: 10, paddingBottom: isVIP ? 100 : 180 }}
                        showsVerticalScrollIndicator={false}
                    />

                    {!isVIP && fans.length > 0 && (
                        <View style={styles.paywallOverlay}>
                            <BlurView intensity={70} tint="dark" style={styles.paywallBlur}>
                                <LinearGradient
                                    colors={['rgba(236,72,153,0.1)', 'transparent']}
                                    style={StyleSheet.absoluteFillObject}
                                />
                                <Ionicons name="star" size={32} color="#fcd34d" style={{ marginBottom: 8 }} />
                                <Text style={styles.paywallTitle}>Gizli Hayranlarını Gör</Text>
                                <Text style={styles.paywallDesc}>Seni kimlerin favorilere eklediğini görmek için hemen VIP ol.</Text>
                                <TouchableOpacity
                                    style={styles.vipButton}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        navigation.navigate('VipDetails', { user });
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={['#8b5cf6', '#d946ef']}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                        style={styles.vipButtonGradient}
                                    >
                                        <Text style={styles.vipButtonText}>VIP Ayrıcalıklarını Keşfet</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </BlurView>
                        </View>
                    )}
                </>
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
    avatarWrapper: {
        width: 56,
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
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
    lastMsg: {
        fontSize: 14,
        paddingRight: 16,
    },
    metaContainer: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        marginLeft: 8,
    },
    time: {
        fontSize: 12,
        fontWeight: '500',
    },
    paywallOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 220,
        justifyContent: 'flex-end',
    },
    paywallBlur: {
        padding: 24,
        paddingBottom: 40,
        alignItems: 'center',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    paywallTitle: {
        color: 'white',
        fontSize: 22,
        fontWeight: '900',
        marginBottom: 8,
    },
    paywallDesc: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    vipButton: {
        width: '100%',
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
    },
    vipButtonGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    vipButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800',
    },
});
