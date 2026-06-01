import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Modal, TextInput, FlatList, Alert, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AnimatedPostCard from '../components/animated/AnimatedPostCard';
import LikeAnimation from '../components/animated/LikeAnimation';
import StoryRing from '../components/animated/StoryRing';
import VipFrame from '../components/ui/VipFrame';
import { useTheme } from '../contexts/ThemeContext';
import { resolveImageUrl } from '../utils/imageUtils';
import { maskContactInfo } from '../utils/textUtils';

import { API_URL } from '../config';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { useAlert } from '../contexts/AlertContext';

const { height, width } = Dimensions.get('window');

const normalizeText = (value = '') => {
    if (!value) return '';
    let text = value.toString();
    
    // Manual Turkish character replacement for maximum reliability
    text = text.replace(/İ/g, 'i')
               .replace(/I/g, 'ı')
               .replace(/ı/g, 'i')
               .replace(/Ş/g, 's')
               .replace(/ş/g, 's')
               .replace(/Ğ/g, 'g')
               .replace(/ğ/g, 'g')
               .replace(/Ü/g, 'u')
               .replace(/ü/g, 'u')
               .replace(/Ö/g, 'o')
               .replace(/ö/g, 'o')
               .replace(/Ç/g, 'c')
               .replace(/ç/g, 'c');

    return text.toLowerCase()
               .normalize('NFD')
               .replace(/[\u0300-\u036f]/g, '')
               .replace(/[^a-z0-9\s]/g, ' ')
               .replace(/\s+/g, ' ')
               .trim();
};

const getProfileGender = (profile = {}) => {
    const raw = (profile.gender || '').toString().trim().toLowerCase();
    if (raw === 'coin_bayisi') return 'coin_bayisi';
    if (raw === 'erkek' || raw === 'male' || raw === 'man') return 'erkek';
    if (raw === 'kadin' || raw === 'female' || raw === 'woman') return 'kadin';
    return '';
};

const FallbackImage = ({ url, style, isAvatar = false, theme }) => {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setHasError(false);
    }, [url]);

    if (hasError || !url) {
        return (
            <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: theme?.colors?.backgroundSecondary || 'rgba(15,23,42,0.5)' }]}>
                <Ionicons name={isAvatar ? "person" : "image-outline"} size={isAvatar ? 20 : 40} color={theme?.colors?.textSecondary || 'rgba(255,255,255,0.3)'} />
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

export default function ExploreScreen({ navigation, route }) {
    const { showAlert } = useAlert();
    const { theme, themeMode } = useTheme();
    const [user, setUser] = useState(route?.params?.user || null);
    const [posts, setPosts] = useState([]);
    const [stories, setStories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCommentsVisible, setCommentsVisible] = useState(false);
    const [activePostId, setActivePostId] = useState(null);
    const [operators, setOperators] = useState([]);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [isPostingComment, setIsPostingComment] = useState(false);
    const [isOptionsVisible, setOptionsVisible] = useState(false);
    const [selectedPostForOptions, setSelectedPostForOptions] = useState(null);
    const scrollY = useSharedValue(0);

    const handleOpenOptions = (post) => {
        setSelectedPostForOptions(post);
        setOptionsVisible(true);
    };

    const handleReport = async () => {
        if (!selectedPostForOptions || !user) return;
        setOptionsVisible(false);
        try {
            const token = await AsyncStorage.getItem('token');
            await axios.post(`${API_URL}/report`, {
                reportedId: selectedPostForOptions.operator_id || selectedPostForOptions.user_id,
                reason: 'Explore Report',
                details: `Post ID: ${selectedPostForOptions.id}`
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showAlert({
                title: "Bildirildi 🚨",
                message: "Bu gönderi incelenmek üzere bildirildi.",
                type: "success"
            });
        } catch (error) {
            console.error('Report error:', error);
            showAlert({
                title: "Hata",
                message: "Bildirme işlemi sırasında bir hata oluştu.",
                type: "error"
            });
        }
    };

    const handleBlock = async () => {
        if (!selectedPostForOptions || !user) return;
        setOptionsVisible(false);
        try {
            const token = await AsyncStorage.getItem('token');
            await axios.post(`${API_URL}/block`, {
                blockedId: selectedPostForOptions.operator_id || selectedPostForOptions.user_id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showAlert({
                title: "Engellendi 🚫",
                message: "Bu kullanıcı engellendi.",
                type: "success"
            });
            // Refresh feed to remove blocked user's content
            fetchExploreData();
        } catch (error) {
            console.error('Block error:', error);
            showAlert({
                title: "Hata",
                message: "Engelleme işlemi sırasında bir hata oluştu.",
                type: "error"
            });
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchUser();
            // Only fetch if we have no posts yet, to prevent lag on every tab switch
            if (posts.length === 0) {
                fetchExploreData();
            }
        }, [posts.length])
    );

    const fetchUser = async () => {
        try {
            const userStr = await AsyncStorage.getItem('user');
            if (userStr) {
                const userData = JSON.parse(userStr);
                setUser(userData);
            }
        } catch (e) {
            console.error('User load error:', e);
        }
    };

    const fetchExploreData = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token');
            const [exploreRes, operatorsRes] = await Promise.all([
                axios.get(`${API_URL}/social/explore`, {
                    params: { user_id: user?.id },
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                }),
                axios.get(`${API_URL}/operators?limit=100`)
            ]);
            // Apply gender filtering to posts and stories
            const userGender = getProfileGender(user) === 'kadin' ? 'kadin' : 'erkek';
            const targetGender = userGender === 'kadin' ? 'erkek' : 'kadin';
            
            const filteredPosts = exploreRes.data.posts.filter(p => {
                const profileGender = getProfileGender(p);
                const isDealerOrAdmin = profileGender === 'coin_bayisi' || p.role === 'admin';
                return userGender === 'kadin' || profileGender === targetGender || isDealerOrAdmin;
            });
            
            const filteredStories = exploreRes.data.stories.filter(s => {
                const profileGender = getProfileGender(s);
                const isDealerOrAdmin = profileGender === 'coin_bayisi' || s.role === 'admin';
                return userGender === 'kadin' || profileGender === targetGender || isDealerOrAdmin;
            });

            setPosts(filteredPosts);
            setStories(filteredStories);
            setOperators(operatorsRes.data.filter(op => {
                const profileGender = getProfileGender(op);
                const isDealer = profileGender === 'coin_bayisi';
                return userGender === 'kadin' || profileGender === targetGender || isDealer;
            }));
        } catch (err) {
            console.error('Fetch Explore Error:', err);
        } finally {
            setLoading(false);
        }
    };


    const likePost = async (postId) => {
        if (!user?.id) return;

        // Optimistic UI Update
        setPosts(prev => prev.map(post => {
            if (post.id === postId) {
                const isLiked = !!post.liked;
                const currentCount = parseInt(post.likes_count) || 0;
                return {
                    ...post,
                    likes_count: isLiked ? Math.max(0, currentCount - 1) : currentCount + 1,
                    liked: !isLiked
                };
            }
            return post;
        }));

        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/social/post/${postId}/like`,
                { user_id: user.id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Sync with actual result from server just in case
            setPosts(prev => prev.map(post => {
                if (post.id === postId) {
                    return { ...post, liked: res.data.liked };
                }
                return post;
            }));
        } catch (err) {
            console.error('Like toggle error:', err);
            // Revert on error
            fetchExploreData();
        }
    };

    const handleDoubleTapLike = (postId) => {
        const post = posts.find(p => p.id === postId);
        if (post && !post.liked) {
            likePost(postId);
        }
    };

    const fetchComments = async (postId) => {
        try {
            setActivePostId(postId);
            setCommentsVisible(true);
            const res = await axios.get(`${API_URL}/social/post/${postId}/comments`);
            setComments(res.data);
        } catch (err) {
            console.error('Fetch Comments Error:', err);
        }
    };

    const handleCommentSubmit = async () => {
        if (!newComment.trim() || !activePostId || isPostingComment) return;
        setIsPostingComment(true);

        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/social/post/${activePostId}/comments`, {
                user_id: user.id,
                content: newComment
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setComments(prev => [...prev, res.data]);
            setNewComment('');

            // Update comments_count in posts list
            setPosts(prev => prev.map(p => {
                if (p.id === activePostId) {
                    return { ...p, comments_count: (parseInt(p.comments_count) || 0) + 1 };
                }
                return p;
            }));
        } catch (err) {
            console.error('Post Comment Error:', err);
        } finally {
            setIsPostingComment(false);
        }
    };

    const checkVipAccess = (actionType) => {
        const userVipLevel = user?.vip_level || 0;
        if (userVipLevel >= 2) {
            return true;
        }

        showAlert({
            title: "VIP Özellik 👑",
            message: `${actionType === 'story' ? 'Hikaye' : 'Post'} paylaşmak için VIP Seviye 2 veya üzeri olmalısın.`,
            type: 'warning',
            showCancel: true,
            cancelText: "Vazgeç",
            confirmText: "VIP Ol",
            onConfirm: () => navigation.navigate('Vip')
        });
        return false;
    };

    const handleStoryCreation = () => {
        const hasStory = !!user?.hasStory;

        if (hasStory) {
            // Mevcut hikayeyi izle (kısıtlama yok)
            navigation.navigate('Story', { story: { ...user, name: 'Sen', avatar: user.avatar_url || user.avatar, id: user.id, image_url: stories.find(s => s.operator_id === user.id)?.image_url } });
        } else {
            // Yeni hikaye ekle (VIP 2+ Kısıtlaması)
            if (checkVipAccess('story')) {
                navigation.navigate('CreatePost', { isStory: true });
            }
        }
    };

    const handlePostCreation = () => {
        // Yeni Post ekle (VIP 2+ Kısıtlaması)
        if (checkVipAccess('post')) {
            navigation.navigate('CreatePost', { isStory: false });
        }
    };

    const renderStory = ({ item, index }) => {
        if (item.id === 'add') {
            const hasStory = !!user?.hasStory;
            return (
                <View style={[styles.storyContainer, { height: 95, justifyContent: 'center' }]}>
                    <TouchableOpacity
                        style={styles.addStoryContainer}
                        onPress={handleStoryCreation}
                    >
                        <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
                            <VipFrame
                                level={(user?.gender === 'coin_bayisi') ? 'dealer' : (user?.vip_level || user?.level || 0)}
                                avatar={user?.avatar_url || user?.avatar}
                                size={76}
                                isStatic={true}
                            />
                            {hasStory && (
                                <View style={{ position: 'absolute', pointerEvents: 'none' }}>
                                    <StoryRing hasNewStory={true} size={62} />
                                </View>
                            )}
                            {!hasStory && (
                                <LinearGradient
                                    colors={['#3b82f6', '#2563eb']}
                                    style={styles.instagramAddBadge}
                                >
                                    <Ionicons name="add" size={14} color="white" />
                                </LinearGradient>
                            )}
                        </View>
                    </TouchableOpacity>
                </View>
            );
        }
        return (
            <View style={[styles.storyContainer, { height: 95, justifyContent: 'center' }]}>
                <TouchableOpacity
                    style={styles.addStoryContainer}
                    onPress={() => navigation.navigate('Story', { story: item })}
                >
                    <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
                        <VipFrame
                            level={(item.gender === 'coin_bayisi') ? 'dealer' : (item.level || 0)}
                            avatar={item.avatar}
                            size={item.level >= 5 ? 76 : 66}
                            isStatic={true}
                        />
                        <View style={{ position: 'absolute', pointerEvents: 'none' }}>
                            <StoryRing hasNewStory={true} size={60} />
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    const dailyFavorites = useMemo(() => {
        if (!operators || operators.length === 0) return [];

        const date = new Date();
        const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();

        const shuffled = [...operators].sort((a, b) => {
            const idA = (a.id || '').toString();
            const idB = (b.id || '').toString();
            const valA = (parseInt(idA.replace(/-/g, '').substring(0, 8), 16) + seed) % 1000;
            const valB = (parseInt(idB.replace(/-/g, '').substring(0, 8), 16) + seed) % 1000;
            return valA - valB;
        });

        return shuffled.slice(0, 5).map(op => ({
            ...op,
            level: op.gender === 'coin_bayisi' ? 'dealer' : (op.vip_level || 1),
            avatar: op.avatar_url
        }));
    }, [operators]);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const getVipColor = (level) => {
        if (level >= 5) return ['#9333ea', '#6b21a8']; // Purple/Glitch
        if (level >= 4) return ['#3b82f6', '#1d4ed8']; // Blue
        if (level >= 3) return ['#eab308', '#a16207']; // Gold
        if (level >= 2) return ['#94a3b8', '#475569']; // Silver
        return ['#fbbf24', '#d97706']; // Bronze/Yellow default
    };

    const renderHeader = () => (
        <View>
            <View style={[styles.storiesContainer, { borderBottomWidth: 0, marginTop: 10 }]}>
                <FlatList
                    horizontal
                    data={[{ id: 'add', online: false }, ...stories]}
                    renderItem={renderStory}
                    keyExtractor={item => item.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.storiesList}
                />
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20, marginTop: 5 }} />

            {/* Featured Section */}
            <View style={styles.featuredContainer}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Günün Favorileri 🔥</Text>
                </View>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={dailyFavorites}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            style={[
                                styles.featuredCard,
                                {
                                    backgroundColor: themeMode === 'dark' ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255,255,255,0.8)',
                                    borderColor: theme.colors.glassBorder
                                }
                            ]}
                            onPress={() => navigation.navigate('OperatorProfile', { operator: item, user })}
                        >
                            <LinearGradient
                                colors={['rgba(139, 92, 246, 0.2)', 'rgba(217, 70, 239, 0.05)']}
                                style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.featuredAvatarWrapper}>
                                <VipFrame level={item.level} avatar={item.avatar} size={55} isStatic={true} />
                            </View>
                            <Text style={[styles.featuredName, { color: theme.colors.text }]}>{item.name}</Text>

                        </TouchableOpacity>
                    )}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.featuredList}
                />
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20, marginTop: 15, marginBottom: 10 }} />
        </View>
    );

    const [isLightboxVisible, setIsLightboxVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    const handleImagePress = (imageUrl) => {
        setSelectedImage(imageUrl);
        setIsLightboxVisible(true);
    };

    const renderPost = ({ item, index }) => (
        <AnimatedPostCard index={index} scrollY={scrollY}>
            <TouchableOpacity 
                activeOpacity={0.9} 
                onPress={() => handleImagePress(resolveImageUrl(item.image_url || item.image))}
                style={styles.modernCardContainer}
            >
                {/* Main Post Image */}
                <FallbackImage 
                    url={resolveImageUrl(item.image_url || item.image)} 
                    style={styles.modernImage} 
                    theme={theme} 
                />
                
                {/* Top Overlay Gradient */}
                <LinearGradient
                    colors={['rgba(0,0,0,0.6)', 'transparent']}
                    style={styles.modernTopGradient}
                />

                {/* User Info Overlay (Top) */}
                <View style={styles.modernHeader}>
                    <TouchableOpacity 
                        onPress={() => navigation.navigate('OperatorProfile', { operator: item, user })}
                        style={styles.modernUserInfo}
                    >
                        <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
                            <VipFrame
                                level={(item.gender === 'coin_bayisi') ? 'dealer' : (item.level || 0)}
                                avatar={item.avatar}
                                size={56}
                                isStatic={true}
                            />
                            {!!item.hasStory && (
                                <View style={{ position: 'absolute', pointerEvents: 'none' }}>
                                    <StoryRing hasNewStory={true} size={48} />
                                </View>
                            )}
                        </View>
                        <View style={styles.modernNameContainer}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', height: 24 }}>
                                <Text style={[styles.modernUserName, { lineHeight: 24 }]} numberOfLines={1}>{item.userName}</Text>
                                {item.is_verified && (
                                    <Ionicons name="checkmark-circle" size={13} color="#3b82f6" style={{ marginLeft: 4 }} />
                                )}
                                {/* VIP Badge for Header */}
                                {(item.level > 0 || item.gender === 'coin_bayisi') && (
                                    <LinearGradient
                                        colors={item.gender === 'coin_bayisi' ? ['#10b981', '#059669'] : getVipColor(item.level)}
                                        style={[styles.modernVipTag, { marginLeft: 12, marginBottom: 0 }]}
                                    >
                                        <Ionicons name="star" size={8} color="white" />
                                        <Text style={styles.modernVipText}>
                                            {item.gender === 'coin_bayisi' ? 'BAYİ' : `VIP ${item.level}`}
                                        </Text>
                                    </LinearGradient>
                                )}
                            </View>
                            <View style={[styles.modernAgeBadge, { backgroundColor: (item.gender === 'male' || item.gender === 'erkek') ? 'rgba(59, 130, 246, 0.4)' : 'rgba(236, 72, 153, 0.4)' }]}>
                                <Text style={styles.modernAgeText}>{item.age || '18'}</Text>
                            </View>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => handleOpenOptions(item)} style={styles.modernMenuButton}>
                        <Ionicons name="ellipsis-horizontal" size={20} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Bottom Overlay Gradient */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
                    style={styles.modernBottomGradient}
                />

                {/* Bottom Info & Actions */}
                <View style={styles.modernFooter}>
                    <View style={styles.modernCaptionSection}>
                        <Text style={styles.modernCaption} numberOfLines={2}>
                            {maskContactInfo(item.content || item.caption || "Merhaba! Beni takip etmeyi unutma! ✨")}
                        </Text>
                    </View>

                    <View style={styles.modernActions}>
                        <TouchableOpacity onPress={() => likePost(item.id)} style={styles.modernActionButton}>
                            <Ionicons
                                name={item.liked ? "heart" : "heart-outline"}
                                size={24}
                                color={item.liked ? "#f472b6" : "white"}
                            />
                            <Text style={styles.modernActionText}>{item.likes_count || 0}</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity onPress={() => fetchComments(item.id)} style={styles.modernActionButton}>
                            <Ionicons name="chatbubble-outline" size={22} color="white" />
                            <Text style={styles.modernActionText}>{item.comments_count || 0}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <LikeAnimation
                    onLike={() => handleDoubleTapLike(item.id)}
                    showIcon={false}
                />
            </TouchableOpacity>
        </AnimatedPostCard>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <LinearGradient
                    colors={themeMode === 'dark' ? theme.gradients.dark : [theme.colors.background, theme.colors.backgroundSecondary]}
                    style={StyleSheet.absoluteFill}
                />
            </View>

            <Animated.FlatList
                onScroll={scrollHandler}
                data={posts}
                keyExtractor={item => item.id}
                renderItem={renderPost}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.feedList}
                scrollEventThrottle={16}
                ListHeaderComponent={renderHeader}
                removeClippedSubviews={Platform.OS === 'android'}
                maxToRenderPerBatch={5}
                windowSize={5}
                initialNumToRender={3}
            />

            {/* Lightbox Modal */}
            <Modal
                visible={isLightboxVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsLightboxVisible(false)}
            >
                <View style={styles.lightboxContainer}>
                    <TouchableOpacity 
                        style={StyleSheet.absoluteFill} 
                        onPress={() => setIsLightboxVisible(false)}
                    >
                        <View style={styles.lightboxOverlay} />
                    </TouchableOpacity>
                    
                    <View style={styles.lightboxContent}>
                        <Image 
                            source={{ uri: selectedImage }} 
                            style={styles.lightboxImage} 
                            resizeMode="contain"
                        />
                        <TouchableOpacity 
                            style={styles.lightboxClose}
                            onPress={() => setIsLightboxVisible(false)}
                        >
                            <Ionicons name="close-circle" size={40} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Floating Action Button for New Post */}
            <TouchableOpacity
                style={styles.fabContainer}
                onPress={handlePostCreation}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={['#8b5cf6', '#d946ef']}
                    style={styles.fabGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Ionicons name="add" size={32} color="white" />
                </LinearGradient>
            </TouchableOpacity>

            <Modal
                visible={isCommentsVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setCommentsVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.commentsContent, { backgroundColor: theme.colors.backgroundSecondary }]}>
                        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.glassBorder }]}>
                            <View style={[styles.modalHandle, { backgroundColor: theme.colors.textSecondary, opacity: 0.2 }]} />
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Yorumlar</Text>
                        </View>
                        <Animated.FlatList
                            data={comments}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <View style={styles.commentItem}>
                                    <FallbackImage url={resolveImageUrl(item.avatar)} style={styles.commentAvatar} isAvatar={true} theme={theme} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.commentUser, { color: theme.colors.text }]}>{item.userName}</Text>
                                        <Text style={[styles.commentText, { color: theme.colors.textSecondary }]}>{item.content}</Text>
                                    </View>
                                </View>
                            )}
                            contentContainerStyle={{ padding: 20 }}
                            ListEmptyComponent={() => (
                                <View style={{ alignItems: 'center', marginTop: 50 }}>
                                    <Text style={{ color: theme.colors.textSecondary }}>Henüz yorum yok. İlk yorumu sen yaz!</Text>
                                </View>
                            )}
                        />
                        <View style={[styles.commentInputContainer, { borderTopColor: theme.colors.glassBorder }]}>
                            <TextInput
                                placeholder="Yorum yaz..."
                                placeholderTextColor={theme.colors.textSecondary}
                                style={[styles.commentInput, { backgroundColor: theme.colors.glass, color: theme.colors.text }]}
                                value={newComment}
                                onChangeText={setNewComment}
                                onSubmitEditing={handleCommentSubmit}
                            />
                            <TouchableOpacity onPress={handleCommentSubmit} disabled={isPostingComment}>
                                <LinearGradient colors={['#8b5cf6', '#d946ef']} style={[styles.commentSend, isPostingComment && { opacity: 0.5 }]}>
                                    {isPostingComment ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <Ionicons name="send" size={18} color="white" />
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.dismissOverlay} onPress={() => setCommentsVisible(false)} />
                </View>
            </Modal>

            {/* Options Modal */}
            <Modal
                visible={isOptionsVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setOptionsVisible(false)}
            >
                <View style={[styles.modalOverlay, { justifyContent: 'flex-end' }]}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setOptionsVisible(false)} />
                    <View style={[styles.optionsContainer, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.glassBorder }]}>
                        <View style={styles.optionsHandle} />
                        <Text style={[styles.optionsTitle, { color: theme.colors.text }]}>Seçenekler</Text>

                        <TouchableOpacity style={styles.optionItem} onPress={handleReport}>
                            <View style={[styles.optionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                                <Ionicons name="flag" size={20} color="#ef4444" />
                            </View>
                            <Text style={[styles.optionText, { color: '#ef4444' }]}>Bu Gönderiyi Bildir</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.optionItem} onPress={handleBlock}>
                            <View style={[styles.optionIcon, { backgroundColor: 'rgba(100, 116, 139, 0.1)' }]}>
                                <Ionicons name="ban" size={20} color={theme.colors.text} />
                            </View>
                            <Text style={[styles.optionText, { color: theme.colors.text }]}>Kullanıcıyı Engelle</Text>
                        </TouchableOpacity>

                        <View style={{ height: 1, backgroundColor: theme.colors.glassBorder, marginVertical: 10 }} />

                        <TouchableOpacity style={styles.optionItem} onPress={() => setOptionsVisible(false)}>
                            <View style={[styles.optionIcon, { backgroundColor: 'rgba(100, 116, 139, 0.1)' }]}>
                                <Ionicons name="close" size={20} color={theme.colors.text} />
                            </View>
                            <Text style={[styles.optionText, { color: theme.colors.text }]}>Vazgeç</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 40,
        paddingBottom: 2, // Boşluk azaltıldı
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: 'white',
        letterSpacing: -0.5,
    },
    addPostGradient: {
        width: 40,
        height: 40,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stickyHeaderContent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingTop: 0,
    },
    feedList: {
        paddingBottom: 130,
    },
    storiesContainer: {
        borderBottomWidth: 1,
    },
    storiesList: {
        paddingHorizontal: 15,
        paddingVertical: 5, // Boşluk azaltıldı
    },
    storyContainer: {
        alignItems: 'center',
        marginHorizontal: 10,
    },
    addStoryContainer: {
        width: 68,
        height: 68,
        position: 'relative',
    },
    instagramAddBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#0095f6',
        borderWidth: 2,
        borderColor: '#0f172a',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    storyAvatarWrapper: {
        position: 'relative',
        padding: 2,
    },
    storyAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#1e293b',
    },
    storyName: {
        color: '#cbd5e1',
        fontSize: 11,
        marginTop: 8,
        fontWeight: '600',
    },
    postCard: {
        marginBottom: 15,
        borderRadius: 30,
        marginHorizontal: 10,
        overflow: 'hidden',
        borderWidth: 1,
    },
    postHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 12,
    },
    postAvatar: {
        width: 40,
        height: 40,
        borderRadius: 15,
        marginRight: 12,
    },
    postHeaderText: {
        flex: 1,
    },
    postUserName: {
        color: 'white',
        fontWeight: '800',
        fontSize: 15,
    },
    postJobTitle: {
        color: '#94a3b8',
        fontSize: 12,
    },
    vipBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginRight: 6,
    },
    vipBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '900',
    },
    verifiedBadge: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    genderAgeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    genderAgeText: {
        fontSize: 11,
        fontWeight: '800',
    },
    postImageContainer: {
        width: '100%',
        aspectRatio: 1,
    },
    postImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
        borderRadius: 36, // Match card radius
    },
    postActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20, // Match postInfo padding
        paddingVertical: 15,
        paddingBottom: 5,
    },
    leftActions: {
        flexDirection: 'row',
        gap: 25,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionCount: {
        fontSize: 16,
        fontWeight: '700',
    },
    postInfo: {
        paddingHorizontal: 20, // Increased padding for better alignment with header
        paddingBottom: 20,
    },
    likesText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 14,
        marginBottom: 6,
    },
    captionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'baseline',
    },
    captionUser: {
        fontWeight: '800',
        fontSize: 14,
        marginRight: 6,
    },
    captionText: {
        lineHeight: 20,
        fontSize: 14,
    },
    viewComments: {
        color: '#94a3b8',
        fontSize: 13,
        marginTop: 8,
        opacity: 0.7,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    dismissOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    commentsContent: {
        borderTopLeftRadius: 35,
        borderTopRightRadius: 35,
        height: '70%',
    },
    modalHeader: {
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        marginBottom: 10,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: 12,
    },
    commentAvatar: {
        width: 36,
        height: 36,
        borderRadius: 14,
    },
    commentUser: {
        fontWeight: '800',
        fontSize: 14,
    },
    commentText: {
        color: '#cbd5e1',
        fontSize: 14,
        marginTop: 2,
    },
    commentInputContainer: {
        flexDirection: 'row',
        padding: 20,
        paddingBottom: 40,
        borderTopWidth: 1,
        gap: 12,
    },
    commentInput: {
        flex: 1,
        borderRadius: 20,
        paddingHorizontal: 20,
        height: 44,
    },
    commentSend: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fabContainer: {
        position: 'absolute',
        bottom: 100, // Restore original position
        right: 25,
        borderRadius: 30,
        elevation: 8,
        shadowColor: '#8b5cf6',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        zIndex: 50,
    },
    fabGradient: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Options Modal Styles
    optionsContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        padding: 20,
        paddingBottom: 40,
        borderTopWidth: 1,
        elevation: 20, // Increased elevation
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -5 }, // Stronger shadow
        shadowOpacity: 0.2, // Increased opacity
        shadowRadius: 15,
        zIndex: 1000, // Ensure it's on top
    },
    optionsHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(148, 163, 184, 0.3)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 15,
    },
    optionsTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 20,
        textAlign: 'center',
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    optionIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
    },
    fabGradient: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    featuredContainer: {
        marginVertical: 10,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    seeAll: {
        fontSize: 12,
        fontWeight: '700',
        opacity: 0.8,
    },
    featuredList: {
        paddingHorizontal: 15,
    },
    featuredCard: {
        width: 105, // Much more compact
        borderRadius: 20,
        padding: 10,
        alignItems: 'center',
        marginHorizontal: 6,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.15)',
        overflow: 'hidden',
        backgroundColor: 'rgba(30, 27, 75, 0.5)', 
    },
    featuredAvatarWrapper: {
        shadowColor: '#d946ef',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        padding: 5, // Add space for the frame to breathe
    },
    featuredCategoryBadge: {
        backgroundColor: 'rgba(217, 70, 239, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginTop: 5,
        borderWidth: 0.5,
        borderColor: 'rgba(217, 70, 239, 0.2)',
    },
    featuredCategoryText: {
        color: '#f472b6',
        fontSize: 8,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    featuredName: {
        marginTop: 6,
        fontSize: 12,
        fontWeight: '800',
    },
    // --- MODERN PREMIUM POST STYLES ---
    modernCardContainer: {
        height: 380,
        borderRadius: 28,
        overflow: 'hidden',
        position: 'relative',
    },
    modernImage: {
        width: '100%',
        height: '100%',
        borderRadius: 28,
    },
    modernTopGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 80,
    },
    modernBottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 160,
    },
    modernHeader: {
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modernUserInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 4,
        paddingRight: 12,
        borderRadius: 30,
        backdropFilter: 'blur(10px)',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    modernNameContainer: {
        marginLeft: 8,
    },
    modernUserName: {
        color: 'white',
        fontSize: 13,
        fontWeight: '800',
    },
    modernAgeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        marginTop: 1,
        alignSelf: 'flex-start',
    },
    modernAgeText: {
        color: 'white',
        fontSize: 9,
        fontWeight: '900',
    },
    modernMenuButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    modernFooter: {
        position: 'absolute',
        bottom: 12,
        left: 15,
        right: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    modernCaptionSection: {
        flex: 1,
        marginRight: 15,
    },
    modernVipTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    modernVipText: {
        color: 'white',
        fontSize: 8,
        fontWeight: '900',
        marginLeft: 2,
    },
    modernCaption: {
        color: 'rgba(255,255,255,0.95)',
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 16,
    },
    modernActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modernActionButton: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 15,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    modernActionText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '800',
        marginTop: 2,
    },
    // Lightbox Styles
    lightboxContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lightboxOverlay: {
        backgroundColor: 'rgba(0,0,0,0.9)',
    },
    lightboxContent: {
        width: width,
        height: height,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lightboxImage: {
        width: width,
        height: height * 0.8,
    },
    lightboxClose: {
        position: 'absolute',
        top: 50,
        right: 25,
        zIndex: 100,
    },
});
