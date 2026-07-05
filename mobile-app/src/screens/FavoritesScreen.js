import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Dimensions, Platform } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { API_URL } from '../config';
import VipFrame from '../components/ui/VipFrame';
import GlassCard from '../components/ui/GlassCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import AnimatedEmptyState from '../components/ui/AnimatedEmptyState';

const { width } = Dimensions.get('window');

export default function FavoritesScreen({ navigation, route }) {
    const { theme } = useTheme();
    const { user } = route.params || {};
    
    const [activeTab, setActiveTab] = useState('whoFavoritedMe'); // 'whoFavoritedMe' or 'whoIFavorited'
    const [favorites, setFavorites] = useState([]); // People I favorited
    const [fans, setFans] = useState([]); // People who favorited me
    const [isVIP, setIsVIP] = useState(false);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        React.useCallback(() => {
            if (user?.id) {
                fetchData();
            } else {
                setLoading(false);
            }
        }, [user, activeTab])
    );

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('token');
            if (activeTab === 'whoFavoritedMe') {
                const res = await axios.get(`${API_URL}/favorites/${user.id}/fans`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setIsVIP(res.data.isVIP);
                setFans(res.data.fans || []);
            } else {
                const res = await axios.get(`${API_URL}/favorites/${user.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setFavorites(res.data || []);
            }
        } catch (error) {
            console.error('Fetch Favorites/Fans Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTimestamp = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Az önce';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} dakika önce`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} saat önce`;
        return `${Math.floor(diffInSeconds / 86400)} gün önce`;
    };

    const renderFavoriteItem = ({ item, index }) => {
        const isWhoFavorited = activeTab === 'whoFavoritedMe';
        const displayBlurred = isWhoFavorited && !isVIP;
        
        const displayName = displayBlurred ? 'Gizli Kullanıcı' : (item.name || item.username);
        const subText = displayBlurred ? 'Bugün Sizi Favorilerine Ekleyenler' : (isWhoFavorited ? 'Sizi favorilerine ekledi' : 'Favorilerinizde kayıtlı');

        return (
            <Animated.View
                entering={FadeInDown.delay(index * 40).springify().damping(13)}
                layout={Layout.springify()}
            >
                <TouchableOpacity
                    onPress={() => {
                        if (isWhoFavorited && !isVIP) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            navigation.navigate('VipDetails', { user });
                            return;
                        }
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const operatorData = {
                            id: item.id,
                            user_id: item.id,
                            name: item.name || item.username,
                            avatar_url: item.avatar_url,
                            gender: item.gender,
                            vip_level: item.vip_level || (item.is_vip ? 1 : 0),
                            is_online: item.is_online
                        };
                        navigation.navigate('OperatorProfile', { operator: operatorData, user });
                    }}
                    style={styles.cardContainer}
                    activeOpacity={0.8}
                >
                    <GlassCard intensity={25} tint="dark" style={styles.favoriteCard}>
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatarWrapper}>
                                <VipFrame
                                    level={item.vip_level || (item.is_vip ? 1 : 0)}
                                    avatar={item.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || item.username || 'User')}&background=random&color=fff`}
                                    size={50}
                                    isStatic={true}
                                />
                                {displayBlurred && (
                                    <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFillObject} />
                                )}
                            </View>
                            {item.is_online && !displayBlurred && (
                                <View style={styles.onlineBadge} />
                            )}
                        </View>

                        <View style={styles.content}>
                            <Text style={styles.name} numberOfLines={1}>
                                {displayName}
                            </Text>
                            <Text style={styles.subText} numberOfLines={1}>
                                {subText}
                            </Text>
                            {item.created_at && (
                                <Text style={styles.timeText}>
                                    {formatTimestamp(item.created_at)}
                                </Text>
                            )}
                        </View>

                        {isWhoFavorited && !isVIP ? (
                            <View style={styles.lockBadge}>
                                <Ionicons name="lock-closed" size={15} color="#FFB300" />
                            </View>
                        ) : (
                            <View style={styles.heartIconBox}>
                                <Ionicons name="heart" size={18} color="#ef4444" />
                            </View>
                        )}
                    </GlassCard>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const currentList = activeTab === 'whoFavoritedMe' ? fans : favorites;

    return (
        <View style={styles.container}>
            {/* Background Image Layer identical to Profile Screen */}
            <View style={styles.bgWrapper}>
                <Image 
                    source={require('../../assets/fiva_profile_banner.png')} 
                    style={styles.backgroundImage}
                />
                <LinearGradient
                    colors={['rgba(9, 2, 26, 0.15)', 'rgba(9, 2, 26, 0.8)', '#09021a']}
                    style={StyleSheet.absoluteFill}
                />
            </View>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Favori Kullanıcı</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Segmented Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'whoFavoritedMe' && styles.activeTabButton]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setActiveTab('whoFavoritedMe');
                    }}
                    activeOpacity={0.7}
                >
                    <Text style={[
                        styles.tabText,
                        activeTab === 'whoFavoritedMe' ? styles.activeTabText : styles.inactiveTabText
                    ]}>
                        Beni kim ekledi
                    </Text>
                    {activeTab === 'whoFavoritedMe' && (
                        <LinearGradient
                            colors={['#EC4899', '#7C3AED']}
                            style={styles.activeTabIndicator}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        />
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'whoIFavorited' && styles.activeTabButton]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setActiveTab('whoIFavorited');
                    }}
                    activeOpacity={0.7}
                >
                    <Text style={[
                        styles.tabText,
                        activeTab === 'whoIFavorited' ? styles.activeTabText : styles.inactiveTabText
                    ]}>
                        Favori Eklediklerim
                    </Text>
                    {activeTab === 'whoIFavorited' && (
                        <LinearGradient
                            colors={['#EC4899', '#7C3AED']}
                            style={styles.activeTabIndicator}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        />
                    )}
                </TouchableOpacity>
            </View>
            <View style={styles.tabDivider} />

            {loading ? (
                <View style={{ padding: 16 }}>
                    {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
                </View>
            ) : currentList.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <AnimatedEmptyState
                        icon="heart-outline"
                        title={activeTab === 'whoFavoritedMe' ? "Hâlâ Boş" : "Favori Yok"}
                        description={activeTab === 'whoFavoritedMe' 
                            ? "Henüz kimse seni favorilerine eklememiş. Profilini tamamla ve öne çık!"
                            : "Henüz kimseyi favorilerine eklememişsin. Keşfet sayfasından yeni insanlarla tanışın!"}
                        colors={['#EF4444', '#F43F5E']}
                    />
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <FlatList
                        data={currentList}
                        renderItem={renderFavoriteItem}
                        keyExtractor={(item, idx) => (item.id || idx).toString() + '-' + (item.created_at || idx)}
                        contentContainerStyle={{ 
                            paddingVertical: 12, 
                            paddingBottom: (!isVIP && activeTab === 'whoFavoritedMe') ? 140 : 50 
                        }}
                        showsVerticalScrollIndicator={false}
                    />

                    {/* Gold Premium Paywall Action Button at the Bottom */}
                    {!isVIP && activeTab === 'whoFavoritedMe' && (
                        <View style={styles.paywallOverlay}>
                            <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />
                            <LinearGradient
                                colors={['rgba(9, 2, 26, 0.0)', 'rgba(9, 2, 26, 0.85)', '#09021a']}
                                style={StyleSheet.absoluteFillObject}
                            />
                            
                            <TouchableOpacity
                                style={styles.paywallBtn}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    navigation.navigate('VipDetails', { user });
                                }}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#FFE082', '#FFB300']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.paywallGradient}
                                >
                                    <Text style={styles.paywallBtnText}>VIP 4 seviyesinde kullanılabilir.</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09021a',
    },
    bgWrapper: {
        position: 'absolute',
        width: '100%',
        height: 400,
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 15,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginTop: 10,
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        position: 'relative',
    },
    activeTabButton: {},
    tabText: {
        fontSize: 14,
        letterSpacing: -0.2,
    },
    activeTabText: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    inactiveTabText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontWeight: '600',
    },
    activeTabIndicator: {
        position: 'absolute',
        bottom: 0,
        width: 48,
        height: 3,
        borderRadius: 1.5,
    },
    tabDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginHorizontal: 20,
        marginBottom: 10,
    },
    cardContainer: {
        marginBottom: 10,
        marginHorizontal: 16,
    },
    favoriteCard: {
        flexDirection: 'row',
        padding: 10,
        borderRadius: 16,
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
    },
    avatarWrapper: {
        width: 50,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
    },
    onlineBadge: {
        position: 'absolute',
        bottom: 1,
        right: 1,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#10b981',
        borderWidth: 2,
        borderColor: '#110C24',
        zIndex: 2,
    },
    content: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    name: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    subText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 11,
        marginTop: 2,
    },
    timeText: {
        color: 'rgba(255, 255, 255, 0.3)',
        fontSize: 9.5,
        marginTop: 2,
    },
    lockBadge: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 179, 0, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 179, 0, 0.15)',
    },
    heartIconBox: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    paywallOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    paywallBtn: {
        width: '100%',
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#FFB300',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    paywallGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    paywallBtnText: {
        color: '#09021a',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
});
