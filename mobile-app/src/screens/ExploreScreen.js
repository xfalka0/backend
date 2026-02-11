import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Modal, TextInput, FlatList, Alert } from 'react-native';
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
    const scrollY = useSharedValue(0);

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
            const res = await axios.get(`${API_URL}/social/explore`);
            setPosts(res.data.posts);
            setStories(res.data.stories);
        } catch (err) {
            console.error('Fetch Explore Error:', err);
        } finally {
            setLoading(false);
        }
    };


    const likePost = (postId) => {
        setPosts(prev => prev.map(post => {
            if (post.id === postId) {
                const isLiked = !!post.liked;
                return {
                    ...post,
                    likes_count: (post.likes_count || 0) + (isLiked ? -1 : 1),
                    liked: !isLiked
                };
            }
            return post;
        }));
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
                                colors={item.level >= 5 ? ['#e879f9', '#d946ef'] : (item.level >= 3 ? ['#fbbf24', '#d97706'] : ['#8b5cf6', '#6366f1'])}
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
                <TouchableOpacity>
                    <Ionicons name="ellipsis-horizontal" size={20} color={themeMode === 'dark' ? 'white' : theme.colors.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.postImageContainer}>
                <Image source={{ uri: item.image_url || item.image }} style={styles.postImage} />
            </View>

            <View style={styles.postActions}>
                <View style={styles.leftActions}>
                    <TouchableOpacity onPress={() => likePost(item.id)}>
                        <Ionicons
                            name={item.liked ? "heart" : "heart-outline"}
                            size={28}
                            color={item.liked ? "#f472b6" : (themeMode === 'dark' ? "white" : theme.colors.text)}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCommentsVisible(true)}>
                        <Ionicons name="chatbubble-outline" size={26} color={themeMode === 'dark' ? "white" : theme.colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.postInfo}>
                <Text style={[styles.likesText, { color: theme.colors.text }]}>{item.likes_count || 0} beğeni</Text>
                <Text style={[styles.caption, { color: theme.colors.textSecondary }]}><Text style={[styles.captionUser, { color: theme.colors.text }]}>{item.userName}</Text> {item.content || item.caption}</Text>
                <TouchableOpacity onPress={() => setCommentsVisible(true)}>
                    <Text style={[styles.viewComments, { color: theme.colors.textSecondary, opacity: 0.7 }]}>Yorumları gör...</Text>
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
                            data={[
                                { id: '1', user: 'Ayşe', text: 'Çok tatlısın 😍' },
                                { id: '2', user: 'Emre', text: '🔥🔥🔥' },
                                { id: '3', user: 'Zeynep', text: 'Merhaba! 👋' }
                            ]}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <View style={styles.commentItem}>
                                    <Image source={{ uri: `https://i.pravatar.cc/150?u=${item.user}` }} style={styles.commentAvatar} />
                                    <View>
                                        <Text style={[styles.commentUser, { color: theme.colors.text }]}>{item.user}</Text>
                                        <Text style={[styles.commentText, { color: theme.colors.textSecondary }]}>{item.text}</Text>
                                    </View>
                                </View>
                            )}
                            contentContainerStyle={{ padding: 20 }}
                        />
                        <View style={[styles.commentInputContainer, { borderTopColor: theme.colors.glassBorder }]}>
                            <TextInput
                                placeholder="Yorum yaz..."
                                placeholderTextColor={theme.colors.textSecondary}
                                style={[styles.commentInput, { backgroundColor: theme.colors.glass, color: theme.colors.text }]}
                            />
                            <TouchableOpacity>
                                <LinearGradient colors={['#8b5cf6', '#d946ef']} style={styles.commentSend}>
                                    <Ionicons name="send" size={18} color="white" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.dismissOverlay} onPress={() => setCommentsVisible(false)} />
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
    },
    postActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15,
        paddingBottom: 5,
    },
    leftActions: {
        flexDirection: 'row',
        gap: 20,
    },
    postInfo: {
        paddingHorizontal: 15,
        paddingBottom: 20,
    },
    likesText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 14,
        marginBottom: 4,
    },
    caption: {
        color: '#cbd5e1',
        lineHeight: 20,
        fontSize: 14,
    },
    captionUser: {
        fontWeight: '800',
    },
    viewComments: {
        color: '#94a3b8',
        fontSize: 13,
        marginTop: 8,
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
        bottom: 100, // Navigation bar üstünde kalması için yükseltildi
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
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
});
