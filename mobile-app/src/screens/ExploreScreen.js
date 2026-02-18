import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Modal, TextInput, FlatList, Alert, ActivityIndicator } from 'react-native';
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

import { API_URL } from '../config';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { useAlert } from '../contexts/AlertContext';

const { width } = Dimensions.get('window');

export default function ExploreScreen({ route, navigation }) {
    const { showAlert } = useAlert();
    const { theme, themeMode } = useTheme();
    const [user, setUser] = useState(route.params?.user || null);
    const [posts, setPosts] = useState([]);
    const [stories, setStories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCommentsVisible, setCommentsVisible] = useState(false);
    const [activePostId, setActivePostId] = useState(null);
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

    const handleReport = () => {
        setOptionsVisible(false);
        showAlert({
            title: "Bildirildi 🚨",
            message: "Bu gönderi incelenmek üzere bildirildi.",
            type: "success"
        });
    };

    const handleBlock = () => {
        setOptionsVisible(false);
        showAlert({
            title: "Engellendi 🚫",
            message: "Bu kullanıcı engellendi.",
            type: "success"
        });
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchUser();
            fetchExploreData();
        }, [])
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
            const res = await axios.get(`${API_URL}/social/explore`, { params: { user_id: user?.id } });
            setPosts(res.data.posts);
            setStories(res.data.stories);
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
            const res = await axios.post(`${API_URL}/social/post/${postId}/like`, { user_id: user.id });
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
                <View style={styles.storyContainer}>
                    <TouchableOpacity
                        style={styles.addStoryContainer}
                        onPress={handleStoryCreation}
                    >
                        <StoryRing hasNewStory={hasStory} size={68}>
                            <View style={styles.storyAvatarWrapper}>
                                <VipFrame
                                    level={user?.vip_level || 0}
                                    avatar={user?.avatar_url || user?.avatar}
                                    size={64}
                                    isStatic={true}
                                />
                                {!hasStory && (
                                    <LinearGradient
                                        colors={['#3b82f6', '#2563eb']}
                                        style={styles.instagramAddBadge}
                                    >
                                        <Ionicons name="add" size={14} color="white" />
                                    </LinearGradient>
                                )}
                            </View>
                        </StoryRing>
                    </TouchableOpacity>
                    <Text style={[styles.storyName, { color: theme.colors.textSecondary }]}>Sen</Text>
                </View>
            );
        }
        return (
            <TouchableOpacity
                style={styles.storyContainer}
                onPress={() => navigation.navigate('Story', { story: item })}
            >
                <StoryRing hasNewStory={true} size={68}>
                    <VipFrame
                        level={item.level || 0}
                        avatar={item.avatar}
                        size={64}
                        isStatic={true}
                    />
                </StoryRing>
                <Text style={[styles.storyName, { color: theme.colors.textSecondary }]} numberOfLines={1}>{item.name}</Text>
            </TouchableOpacity>
        );
    };

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollY.value = event.contentOffset.y;
        },
    });

    const renderHeader = () => (
        <View style={{ backgroundColor: theme.colors.background }}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.colors.text, fontSize: 22, fontWeight: '800' }]}>Hikayeler</Text>
            </View>

            <View style={[styles.storiesContainer, { borderBottomWidth: 1, borderBottomColor: theme.colors.glassBorder }]}>
                <FlatList
                    horizontal
                    data={[{ id: 'add', online: false }, ...stories]}
                    renderItem={renderStory}
                    keyExtractor={item => item.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.storiesList}
                />
            </View>

            {/* Featured Section */}
            <View style={styles.featuredContainer}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Günün Favorileri 🔥</Text>
                    <TouchableOpacity>
                        <Text style={[styles.seeAll, { color: theme.colors.primary }]}>Hepsini Gör</Text>
                    </TouchableOpacity>
                </View>
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={[
                        { id: 'fav_1_zeynep', name: 'Zeynep', level: 2, avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400', category: 'Kültür' },
                        { id: 'fav_2_asli', name: 'Aslı', level: 4, avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400', category: 'Seyahat' },
                        { id: 'fav_3_merve', name: 'Merve', level: 3, avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400', category: 'Fitness' }
                    ]}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.featuredCard, { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.glassBorder }]}
                            onPress={() => navigation.navigate('OperatorProfile', { operator: item, user })}
                        >
                            <LinearGradient
                                colors={['rgba(139, 92, 246, 0.3)', 'transparent']}
                                style={StyleSheet.absoluteFill}
                            />
                            <VipFrame level={item.level} avatar={item.avatar} size={80} isStatic={true} />
                            <Text style={[styles.featuredName, { color: theme.colors.text }]}>{item.name}</Text>
                            <Text style={[styles.featuredCategory, { color: theme.colors.textSecondary }]}>{item.category}</Text>
                        </TouchableOpacity>
                    )}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.featuredList}
                />
            </View>
        </View>
    );

    const renderPost = ({ item, index }) => (
        <AnimatedPostCard index={index} scrollY={scrollY}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                <View style={{ marginRight: 15, marginLeft: -5 }}>
                    <StoryRing hasNewStory={!!item.hasStory} size={68} onPress={() => {
                        if (item.hasStory) {
                            const foundStory = stories.find(s => s.operator_id === item.operator_id);
                            if (foundStory) navigation.navigate('Story', { story: foundStory });
                        } else {
                            navigation.navigate('OperatorProfile', { operator: item, user });
                        }
                    }}>
                        <VipFrame
                            level={item.level || 0}
                            avatar={item.avatar}
                            size={65}
                            isStatic={true}
                        />
                    </StoryRing>
                </View>
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={[styles.postUserName, { color: theme.colors.text, fontSize: 16, fontWeight: '800', marginRight: 6 }]}>
                            {item.userName}
                        </Text>

                        {item.level > 0 && (
                            <LinearGradient
                                colors={
                                    item.level >= 6 ? ['#1a1a1b', '#000000'] :
                                        item.level >= 5 ? ['#e879f9', '#d946ef'] :
                                            (item.level >= 3 ? ['#fbbf24', '#d97706'] : ['#8b5cf6', '#6366f1'])
                                }
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.vipBadgeContainer}
                            >
                                <Ionicons name="star" size={10} color="white" style={{ marginRight: 2 }} />
                                <Text style={styles.vipBadgeText}>VIP {item.level}</Text>
                            </LinearGradient>
                        )}

                        <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={16} color="#3b82f6" />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.postJobTitle, { color: theme.colors.textSecondary, fontSize: 12, marginRight: 8 }]}>
                            {item.jobTitle || item.job || 'Üye'}
                        </Text>

                        {(item.age || item.gender) && (
                            <View style={[
                                styles.genderAgeBadge,
                                { backgroundColor: (item.gender === 'female' || item.gender === 'kadin') ? 'rgba(236, 72, 153, 0.15)' : 'rgba(59, 130, 246, 0.15)' }
                            ]}>
                                <Ionicons
                                    name={(item.gender === 'female' || item.gender === 'kadin') ? "female" : "male"}
                                    size={10}
                                    color={(item.gender === 'female' || item.gender === 'kadin') ? "#ec4899" : "#3b82f6"}
                                    style={{ marginRight: item.age ? 3 : 0 }}
                                />
                                {item.age && (
                                    <Text style={[
                                        styles.genderAgeText,
                                        { color: (item.gender === 'female' || item.gender === 'kadin') ? "#ec4899" : "#3b82f6" }
                                    ]}>
                                        {item.age}
                                    </Text>
                                )}
                            </View>
                        )}
                    </View>
                </View>
                <TouchableOpacity
                    onPress={() => {
                        // console.log('3-dots pressed');
                        handleOpenOptions(item);
                    }}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    style={{ position: 'absolute', top: 15, right: 15, zIndex: 999 }}
                >
                    <Ionicons name="ellipsis-horizontal" size={24} color={themeMode === 'dark' ? 'white' : theme.colors.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.postImageContainer}>
                <Image source={{ uri: item.image_url || item.image }} style={styles.postImage} />
                <LikeAnimation
                    onLike={() => handleDoubleTapLike(item.id)}
                    showIcon={false}
                />
            </View>

            <View style={styles.postActions}>
                <View style={styles.leftActions}>
                    <TouchableOpacity onPress={() => likePost(item.id)} style={styles.actionItem}>
                        <Ionicons
                            name={item.liked ? "heart" : "heart-outline"}
                            size={28}
                            color={item.liked ? "#f472b6" : (themeMode === 'dark' ? "white" : theme.colors.text)}
                        />
                        <Text style={[styles.actionCount, { color: theme.colors.text }]}>{item.likes_count || 0}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => fetchComments(item.id)} style={styles.actionItem}>
                        <Ionicons name="chatbubble-outline" size={26} color={themeMode === 'dark' ? "white" : theme.colors.text} />
                        <Text style={[styles.actionCount, { color: theme.colors.text }]}>{item.comments_count || 0}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.postInfo}>
                <View style={styles.captionRow}>
                    <Text style={[styles.captionUser, { color: theme.colors.text }]}>{item.userName}</Text>
                    <Text style={[styles.captionText, { color: theme.colors.textSecondary }]}>{item.content || item.caption}</Text>
                </View>
                <TouchableOpacity onPress={() => fetchComments(item.id)}>
                    <Text style={[styles.viewComments, { color: theme.colors.textSecondary }]}>
                        {item.comments_count > 0 ? `${item.comments_count} yorumun tümünü gör...` : 'Yorum yaz...'}
                    </Text>
                </TouchableOpacity>
            </View>
        </AnimatedPostCard>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <LinearGradient
                colors={themeMode === 'dark' ? ['#030712', '#0f172a'] : [theme.colors.background, theme.colors.backgroundSecondary]}
                style={StyleSheet.absoluteFill}
            />

            <Animated.FlatList
                onScroll={scrollHandler}
                data={posts}
                keyExtractor={item => item.id}
                renderItem={renderPost}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.feedList}
                scrollEventThrottle={16}
                ListHeaderComponent={renderHeader}
            />

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
                                    <Image source={{ uri: item.avatar }} style={styles.commentAvatar} />
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
        paddingTop: 50,
        paddingBottom: 5, // Boşluk azaltıldı
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
        paddingBottom: 100,
    },
    storiesContainer: {
        borderBottomWidth: 1,
    },
    storiesList: {
        paddingHorizontal: 15,
        paddingVertical: 10, // Boşluk azaltıldı
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
        marginVertical: 15,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.5,
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
        width: 140,
        borderRadius: 24,
        padding: 15,
        paddingBottom: 20, // Extra bottom padding
        alignItems: 'center',
        marginHorizontal: 8,
        borderWidth: 1,
        overflow: 'hidden',
    },
    featuredName: {
        marginTop: 14, // More space from avatar
        fontSize: 15,
        fontWeight: '800',
    },
    featuredCategory: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
});
