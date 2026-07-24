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

const getProfileGender = (profile) => {
    if (!profile) return '';
    let raw = (profile.gender || '').toString().trim().toLowerCase();
    raw = raw.replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
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

const cleanUsername = (name) => {
    if (!name) return '';
    let cleaned = name.replace(/^op_/i, '');
    cleaned = cleaned.replace(/_\d+(-\d+)?$/g, '');
    cleaned = cleaned
        .replace(/[♡♥❤❣💕💖💗💘💙💚💛💜🖤🤍🤎💝💞💟💓💔💌💋]/gu, '')
        .replace(/\uFE0F/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (name.toLowerCase().startsWith('op_') && cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return cleaned;
};

const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const hr = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${d} ${hr}:${min}`;
    } catch (e) {
        return '';
    }
};

const getCategoryTag = (item) => {
    if (item.jobTitle) return item.jobTitle;
    const tags = ['Günün Favorileri', 'Dating', 'Sohbet', 'Aşk & İlişkiler', 'Yemek', 'Seyahat', 'Müzik'];
    const idx = (item.id || 0) % tags.length;
    return tags[idx];
};

const EXPLORE_TABS = [
    { key: 'popular', label: 'Popüler' },
    { key: 'new', label: 'Yeni' },
    { key: 'following', label: 'Takip Edilen' },
];

export default function ExploreScreen({ navigation, route }) {
    console.log("RENDER DiscoverScreen");
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
    const lastFetchedUserId = useRef(null);

    const [chatMap, setChatMap] = useState({}); // { [operatorId]: chatId }
    const [favoriteIds, setFavoriteIds] = useState(new Set()); // Set of operator IDs favorited by user
    const [sentHiList, setSentHiList] = useState(new Set()); // Session-level sent Hi's
    const [hiSheetVisible, setHiSheetVisible] = useState(false);
    const [selectedPostForHi, setSelectedPostForHi] = useState(null);
    const [isSendingHi, setIsSendingHi] = useState(false);
    const [activeFeedTab, setActiveFeedTab] = useState('popular');
    const [commentPreviewMap, setCommentPreviewMap] = useState({});

    // Inline comment states
    const [expandedPosts, setExpandedPosts] = useState({});
    const [postCommentsMap, setPostCommentsMap] = useState({});
    const [postNewCommentMap, setPostNewCommentMap] = useState({});
    const [isPostingCommentMap, setIsPostingCommentMap] = useState({});

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

    const fetchUserChats = async (currentUser) => {
        if (!currentUser?.id) return;
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/users/${currentUser.id}/chats?limit=100&offset=0`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const mapping = {};
            res.data.forEach(chat => {
                if (chat.operator_id) {
                    mapping[chat.operator_id.toString()] = chat.id;
                }
            });
            setChatMap(mapping);
        } catch (e) {
            console.error('Fetch user chats error:', e);
        }
    };

    const fetchUserFavorites = async (currentUser) => {
        if (!currentUser?.id) return;
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.get(`${API_URL}/favorites/${currentUser.id}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const favs = new Set(res.data.map(op => op.id));
            setFavoriteIds(favs);
        } catch (e) {
            console.error('Fetch user favorites error:', e);
        }
    };

    const toggleFavorite = async (operatorId) => {
        if (!user?.id) return;
        const targetId = operatorId;
        const isFav = favoriteIds.has(targetId);
        
        // Optimistic UI Update
        setFavoriteIds(prev => {
            const next = new Set(prev);
            if (isFav) {
                next.delete(targetId);
            } else {
                next.add(targetId);
            }
            return next;
        });

        try {
            const token = await AsyncStorage.getItem('token');
            const url = isFav ? `${API_URL}/favorites/${targetId}` : `${API_URL}/favorites`;
            if (isFav) {
                await axios.delete(url, { 
                    data: { userId: user.id },
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(url, { 
                    userId: user.id, 
                    targetUserId: targetId 
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
        } catch (e) {
            console.error('Toggle favorite error:', e);
            // Revert state on error by refetching favorites
            fetchUserFavorites(user);
        }
    };

    const sendQuickHi = async (item) => {
        if (!user?.id || !item) return;
        const opId = (item.operator_id || item.user_id).toString();
        
        if (isSendingHi) return;
        setIsSendingHi(true);
        
        try {
            const token = await AsyncStorage.getItem('token');
            
            // 1. Create or get chat
            const chatRes = await axios.post(`${API_URL}/chats`, {
                userId: user.id,
                operatorId: item.operator_id || item.user_id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const chatId = chatRes.data?.id;

            if (chatId) {
                // 2. Send the message
                await axios.post(`${API_URL}/messages`, {
                    chatId: chatId,
                    senderId: user.id,
                    content: `Merhaba 👋`,
                    type: 'text'
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                // Update maps
                setChatMap(prev => ({
                    ...prev,
                    [opId]: chatId
                }));
                setSentHiList(prev => {
                    const next = new Set(prev);
                    next.add(opId);
                    return next;
                });
            }
        } catch (error) {
            console.error('Error sending quick Hi:', error);
            if (error.response?.data?.insufficientFunds) {
                navigation.navigate('PurchaseInfo', { user });
            }
        } finally {
            setIsSendingHi(false);
            setHiSheetVisible(false);
            setSelectedPostForHi(null);
        }
    };

    const handleHiPress = (item) => {
        const opId = (item.operator_id || item.user_id).toString();
        const existingChatId = chatMap[opId];
        if (existingChatId) {
            navigation.navigate('Chat', {
                operatorId: item.operator_id || item.user_id,
                name: cleanUsername(item.userName || item.name),
                avatar_url: item.avatar || item.avatar_url,
                vip_level: item.vipLevel || item.vip_level || 0,
                user
            });
        } else {
            sendQuickHi(item);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            const loadAndFetch = async () => {
                try {
                    let currentUser = user;
                    const userStr = await AsyncStorage.getItem('user');
                    if (userStr) {
                        const parsedUser = JSON.parse(userStr);
                        // Prevent infinite loop by only updating state if user data actually changed
                        if (!user || user.id !== parsedUser.id || user.vip_level !== parsedUser.vip_level) {
                            currentUser = parsedUser;
                            setUser(parsedUser);
                        }
                    }
                    
                    if (posts.length === 0 || (currentUser && currentUser.id !== lastFetchedUserId.current)) {
                        await fetchExploreData(currentUser);
                    }
                    if (currentUser) {
                        await fetchUserChats(currentUser);
                        await fetchUserFavorites(currentUser);
                    }
                } catch (e) {
                    console.error('Error in focus effect:', e);
                }
            };

            loadAndFetch();
        }, [posts.length, user])
    );

    const fetchUser = async () => {
        try {
            const userStr = await AsyncStorage.getItem('user');
            if (userStr) {
                const userData = JSON.parse(userStr);
                setUser(userData);
                await fetchUserChats(userData);
                await fetchUserFavorites(userData);
            }
        } catch (e) {
            console.error('User load error:', e);
        }
    };

    const fetchPostCommentPreviews = async (sourcePosts = []) => {
        const postsWithComments = sourcePosts
            .filter(post => (parseInt(post.comments_count) || 0) > 0)
            .filter(post => !Array.isArray(post.preview_comments) || post.preview_comments.length === 0)
            .slice(0, 20);

        if (postsWithComments.length === 0) return;

        try {
            const results = await Promise.all(postsWithComments.map(async post => {
                try {
                    const res = await axios.get(`${API_URL}/social/post/${post.id}/comments`);
                    return [post.id, (res.data || []).slice(0, 2)];
                } catch (error) {
                    console.error('Fetch preview comments error:', error);
                    return [post.id, []];
                }
            }));

            setCommentPreviewMap(prev => {
                const next = { ...prev };
                results.forEach(([postId, preview]) => {
                    next[postId] = preview;
                });
                return next;
            });
        } catch (error) {
            console.error('Fetch post comment previews error:', error);
        }
    };

    const fetchExploreData = async (currentUser) => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token');
            const [exploreRes, operatorsRes] = await Promise.all([
                axios.get(`${API_URL}/social/explore`, {
                    params: { user_id: currentUser?.id },
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                }),
                axios.get(`${API_URL}/operators?limit=100`)
            ]);
            
            lastFetchedUserId.current = currentUser?.id;
            
            // Apply gender filtering to posts and stories
            const userGender = getProfileGender(currentUser) === 'kadin' ? 'kadin' : 'erkek';
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
            fetchPostCommentPreviews(filteredPosts);
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
                    const currentPreview = Array.isArray(p.preview_comments) ? p.preview_comments : [];
                    return {
                        ...p,
                        comments_count: (parseInt(p.comments_count) || 0) + 1,
                        preview_comments: [...currentPreview, res.data].slice(-2)
                    };
                }
                return p;
            }));
            setCommentPreviewMap(prev => {
                const currentPreview = Array.isArray(prev[activePostId]) ? prev[activePostId] : [];
                return {
                    ...prev,
                    [activePostId]: [...currentPreview, res.data].slice(-2)
                };
            });
        } catch (err) {
            console.error('Post Comment Error:', err);
        } finally {
            setIsPostingComment(false);
        }
    };

    const toggleExpandComments = async (postId) => {
        const isCurrentlyExpanded = !!expandedPosts[postId];
        
        // Toggle expansion state
        setExpandedPosts(prev => ({
            ...prev,
            [postId]: !isCurrentlyExpanded
        }));

        // Fetch comments if expanding and not loaded yet
        if (!isCurrentlyExpanded && !postCommentsMap[postId]) {
            try {
                const res = await axios.get(`${API_URL}/social/post/${postId}/comments`);
                setPostCommentsMap(prev => ({
                    ...prev,
                    [postId]: res.data || []
                }));
            } catch (err) {
                console.error('Fetch inline comments error:', err);
            }
        }
    };

    const submitInlineComment = async (postId) => {
        const typedComment = postNewCommentMap[postId] || '';
        if (!typedComment.trim() || !user?.id || isPostingCommentMap[postId]) return;

        setIsPostingCommentMap(prev => ({
            ...prev,
            [postId]: true
        }));

        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.post(`${API_URL}/social/post/${postId}/comments`, {
                user_id: user.id,
                content: typedComment
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Update comments mapping
            setPostCommentsMap(prev => {
                const currentList = prev[postId] || [];
                return {
                    ...prev,
                    [postId]: [...currentList, res.data]
                };
            });

            // Reset text input field
            setPostNewCommentMap(prev => ({
                ...prev,
                [postId]: ''
            }));

            // Increment comments count on post
            setPosts(prev => prev.map(p => {
                if (p.id === postId) {
                    return {
                        ...p,
                        comments_count: (parseInt(p.comments_count) || 0) + 1
                    };
                }
                return p;
            }));

            // Sync with local comment preview map
            setCommentPreviewMap(prev => {
                const currentPreview = Array.isArray(prev[postId]) ? prev[postId] : [];
                return {
                    ...prev,
                    [postId]: [...currentPreview, res.data].slice(-2)
                };
            });

        } catch (err) {
            console.error('Submit inline comment error:', err);
        } finally {
            setIsPostingCommentMap(prev => ({
                ...prev,
                [postId]: false
            }));
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

        const renderStory = React.useCallback(({ item, index }) => {
        if (item.id === 'add') {
            const hasStory = !!user?.hasStory;
            return (
                <View style={[styles.storyContainer, { height: 70, justifyContent: 'center' }]}>
                    <TouchableOpacity
                        style={styles.addStoryContainer}
                        onPress={handleStoryCreation}
                    >
                        <View style={{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }}>
                            <VipFrame
                                level={(user?.gender === 'coin_bayisi') ? 'dealer' : (user?.vip_level || user?.level || 0)}
                                avatar={user?.avatar_url || user?.avatar}
                                size={56}
                                isStatic={true}
                            />
                            {hasStory && (
                                <View style={{ position: 'absolute', pointerEvents: 'none' }}>
                                    <StoryRing hasNewStory={true} size={48} />
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
            <View style={[styles.storyContainer, { height: 70, justifyContent: 'center' }]}>
                <TouchableOpacity
                    style={styles.addStoryContainer}
                    onPress={() => navigation.navigate('Story', { story: item })}
                >
                    <View style={{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }}>
                        <VipFrame
                            level={(item.gender === 'coin_bayisi') ? 'dealer' : (item.level || 0)}
                            avatar={item.avatar}
                            size={item.level >= 5 ? 56 : 48}
                            isStatic={true}
                        />
                        <View style={{ position: 'absolute', pointerEvents: 'none' }}>
                            <StoryRing hasNewStory={true} size={48} />
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        );
    }, [user, navigation, stories, handleStoryCreation]);

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

    const visiblePosts = useMemo(() => {
        if (activeFeedTab === 'following') {
            return posts.filter(post => favoriteIds.has(post.operator_id || post.user_id));
        }

        if (activeFeedTab === 'popular') {
            return [...posts].sort((a, b) => (parseInt(b.likes_count) || 0) - (parseInt(a.likes_count) || 0));
        }

        // 'new' tab: returns as is (already sorted by created_at DESC from API)
        return posts;
    }, [activeFeedTab, favoriteIds, posts]);

    useEffect(() => {
        const missingPreviewPosts = posts.filter(post => {
            const commentCount = parseInt(post.comments_count) || 0;
            const hasServerPreview = Array.isArray(post.preview_comments) && post.preview_comments.length > 0;
            const hasFetchedPreview = Object.prototype.hasOwnProperty.call(commentPreviewMap, post.id);
            return commentCount > 0 && !hasServerPreview && !hasFetchedPreview;
        });

        if (missingPreviewPosts.length > 0) {
            fetchPostCommentPreviews(missingPreviewPosts);
        }
    }, [posts, commentPreviewMap]);

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
        <View style={styles.feedHeaderWrap}>
            <LinearGradient
                colors={themeMode === 'dark'
                    ? ['rgba(168, 85, 247, 0.18)', 'rgba(236, 72, 153, 0.08)', 'rgba(13, 20, 41, 0)']
                    : ['rgba(139, 92, 246, 0.16)', 'rgba(217, 70, 239, 0.07)', 'rgba(248, 250, 252, 0)']}
                locations={[0, 0.55, 1]}
                style={styles.referenceHeaderBg}
            >
                <View style={[styles.confettiDot, { left: 28, top: 8, backgroundColor: '#F7A64A' }]} />
                <View style={[styles.confettiDot, { left: 86, top: 18, backgroundColor: '#80D66E' }]} />
                <View style={[styles.confettiDot, { left: 184, top: 9, backgroundColor: '#F58B76' }]} />
                <View style={[styles.confettiDot, { right: 94, top: 21, backgroundColor: '#65C8EF' }]} />
                <View style={[styles.confettiDot, { right: 42, top: 10, backgroundColor: '#F2B56B' }]} />
                <View style={styles.stadiumArc} />
            </LinearGradient>
            <View style={styles.feedTopBar}>
                <View style={styles.feedTabs}>
                    {EXPLORE_TABS.map(tab => {
                        const isActive = activeFeedTab === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                activeOpacity={0.8}
                                onPress={() => setActiveFeedTab(tab.key)}
                                style={styles.feedTabButton}
                            >
                                <Text style={[
                                    styles.feedTabText,
                                    { color: isActive ? theme.colors.primary : theme.colors.textSecondary },
                                    isActive && styles.feedTabTextActive
                                ]}>
                                    {tab.label}
                                </Text>
                                <View style={[
                                    styles.feedTabIndicator,
                                    { backgroundColor: isActive ? theme.colors.primary : 'transparent' }
                                ]} />
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                        styles.notificationButton,
                        {
                            backgroundColor: 'transparent',
                            borderColor: 'transparent'
                        }
                    ]}
                    onPress={() => navigation.navigate('Notifications', { user })}
                >
                    <Ionicons name="notifications" size={24} color={theme.colors.accent} />
                </TouchableOpacity>
            </View>

            <View style={[styles.storiesContainer, { borderBottomWidth: 0 }]}>
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

    const [isLightboxVisible, setIsLightboxVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    const handleImagePress = (imageUrl) => {
        setSelectedImage(imageUrl);
        setIsLightboxVisible(true);
    };

    const renderPost = React.useCallback(({ item }) => {
        const isConnected = !!(chatMap[(item.operator_id || item.user_id).toString()] || sentHiList.has((item.operator_id || item.user_id).toString()));
        const isFav = favoriteIds.has(item.operator_id || item.user_id);
        const actionMuted = themeMode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(100,116,139,0.55)';
        const previewComments = Array.isArray(item.preview_comments) && item.preview_comments.length > 0
            ? item.preview_comments.slice(0, 2)
            : Array.isArray(commentPreviewMap[item.id])
                ? commentPreviewMap[item.id].slice(0, 2)
                : Array.isArray(item.comments)
                    ? item.comments.slice(0, 2)
                    : [];
        const commentCount = parseInt(item.comments_count) || 0;
        
        return (
            <View style={[
                styles.restructuredCard,
                {
                    backgroundColor: 'transparent',
                    borderColor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
                }
            ]}>
                {/* Header Row */}
                <View style={styles.cardHeaderRow}>
                    <TouchableOpacity 
                        onPress={() => navigation.navigate('OperatorProfile', { 
                            operator: {
                                ...item,
                                id: item.operator_id || item.user_id,
                                name: item.userName || item.name,
                                avatar_url: item.avatar
                            }, 
                            user 
                        })}
                        style={styles.headerLeftCol}
                    >
                        <View style={styles.headerAvatarContainer}>
                            <VipFrame
                                level={(item.gender === 'coin_bayisi') ? 'dealer' : (item.vipLevel || item.vip_level || 0)}
                                avatar={item.avatar}
                                size={46}
                                isStatic={true}
                            />
                            {!!item.hasStory && (
                                <View style={{ position: 'absolute', pointerEvents: 'none' }}>
                                    <StoryRing hasNewStory={true} size={40} />
                                </View>
                            )}
                        </View>
                        <View style={styles.headerMetaCol}>
                            <View style={styles.headerNameBadgeRow}>
                                <Text style={[styles.headerNameText, { color: theme.colors.text }]} numberOfLines={1}>
                                    {cleanUsername(item.userName || item.name)}
                                </Text>
                                <View style={[styles.headerAgeBadge, { backgroundColor: (item.gender === 'male' || item.gender === 'erkek') ? '#3b82f6' : '#ec4899' }]}>
                                    <Ionicons name={(item.gender === 'male' || item.gender === 'erkek') ? "male" : "female"} size={8} color="white" />
                                    <Text style={styles.headerAgeText}>{item.age || '18'}</Text>
                                </View>
                                {item.is_verified && (
                                    <Ionicons name="checkmark-circle" size={13} color="#3b82f6" />
                                )}
                                {(item.vipLevel > 0 || item.gender === 'coin_bayisi') && (
                                    <LinearGradient
                                        colors={item.gender === 'coin_bayisi' ? ['#10b981', '#059669'] : getVipColor(item.vipLevel || item.vip_level)}
                                        style={styles.headerVipBadge}
                                    >
                                        <Text style={styles.headerVipText}>
                                            {item.gender === 'coin_bayisi' ? 'BAYI' : 'VIP'}
                                        </Text>
                                    </LinearGradient>
                                )}
                            </View>
                            <Text style={[styles.headerTimeText, { color: theme.colors.textSecondary }]}>
                                {formatDate(item.created_at)}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Pill Hi Button */}
                    <TouchableOpacity 
                        onPress={() => handleHiPress(item)} 
                        style={styles.pillHiButton}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={isConnected ? ['#10B981', '#059669'] : ['#8b5cf6', '#d946ef']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.pillHiGradient}
                        >
                            <Text style={styles.pillHiButtonText}>
                                {isConnected ? "💬 Mesaj" : "👋 Hi"}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Caption / Content text (Moved above the image) */}
                {(item.content || item.caption) ? (
                    <Text style={[styles.restructuredCaption, { color: theme.colors.text }]} numberOfLines={2}>
                        {maskContactInfo(item.content || item.caption)}
                    </Text>
                ) : null}

                {/* Centered Post Image */}
                <TouchableOpacity 
                    activeOpacity={0.9} 
                    onPress={() => handleImagePress(resolveImageUrl(item.image_url || item.image))}
                    style={[
                        styles.imageCardContainer,
                        { backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.05)' : theme.colors.backgroundSecondary }
                    ]}
                >
                    <FallbackImage 
                        url={resolveImageUrl(item.image_url || item.image)} 
                        style={styles.restructuredImage} 
                        theme={theme} 
                    />
                    <LikeAnimation
                        onLike={() => handleDoubleTapLike(item.id)}
                        showIcon={false}
                    />
                </TouchableOpacity>

                {/* Horizontal Footer row */}
                <View style={styles.restructuredFooter}>
                    <View style={styles.footerLeftActions}>
                        {/* Like Action */}
                        <TouchableOpacity onPress={() => likePost(item.id)} style={styles.footerActionBtn}>
                            <Ionicons
                                name={item.liked ? "heart" : "heart-outline"}
                                size={22}
                                color={item.liked ? "#ff4d8d" : actionMuted}
                            />
                            <Text style={[styles.footerActionText, { color: item.liked ? "#ff4d8d" : actionMuted }]}>
                                {item.likes_count || 0}
                            </Text>
                        </TouchableOpacity>

                        {/* Comment Action */}
                        <TouchableOpacity onPress={() => toggleExpandComments(item.id)} style={styles.footerActionBtn}>
                            <Ionicons name="chatbubble-outline" size={20} color={actionMuted} />
                            <Text style={[styles.footerActionText, { color: actionMuted }]}>
                                {commentCount > 99 ? '99+' : commentCount}
                            </Text>
                        </TouchableOpacity>

                        {/* Share Action */}
                        <TouchableOpacity onPress={() => {}} style={styles.footerActionBtn}>
                            <Ionicons name="paper-plane-outline" size={20} color={actionMuted} />
                        </TouchableOpacity>

                        {/* Favorite Action / Follow */}
                        <TouchableOpacity onPress={() => toggleFavorite(item.operator_id || item.user_id)} style={styles.footerActionBtn}>
                            <Ionicons 
                                name={isFav ? "bookmark" : "bookmark-outline"} 
                                size={20} 
                                color={isFav ? "#FFD700" : actionMuted} 
                            />
                        </TouchableOpacity>
                    </View>

                    {/* More Menu options (Far Right) */}
                    <TouchableOpacity onPress={() => handleOpenOptions(item)} style={styles.footerMoreBtn}>
                        <Ionicons name="ellipsis-horizontal" size={20} color={actionMuted} />
                    </TouchableOpacity>
                </View>

                {/* Inline Comment Block */}
                {(previewComments.length > 0 || commentCount > 0 || expandedPosts[item.id]) && (
                    <View style={styles.commentPreviewBlock}>
                        {/* If expanded, render allComments, otherwise render previewComments */}
                        {(expandedPosts[item.id] ? (postCommentsMap[item.id] || previewComments) : previewComments).map(comment => (
                            <View key={comment.id} style={styles.commentPreviewRow}>
                                <FallbackImage 
                                    url={resolveImageUrl(comment.avatar, 'avatar')} 
                                    style={styles.commentPreviewAvatar} 
                                    isAvatar={true}
                                    theme={theme} 
                                />
                                <Text style={styles.commentPreviewTextContainer} numberOfLines={1}>
                                    <Text style={[styles.commentPreviewName, { color: theme.colors.text }]}>
                                        {cleanUsername(comment.userName || comment.name)}
                                    </Text>
                                    <Text style={{ color: theme.colors.textSecondary }}>
                                        {"  "}{maskContactInfo(comment.content || '')}
                                    </Text>
                                </Text>
                            </View>
                        ))}
                        
                        {/* Toggle button */}
                        {expandedPosts[item.id] ? (
                            <TouchableOpacity onPress={() => toggleExpandComments(item.id)} activeOpacity={0.75}>
                                <Text style={[styles.viewAllComments, { color: theme.colors.secondary }]}>
                                    Yorumları Gizle
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            commentCount > previewComments.length && (
                                <TouchableOpacity onPress={() => toggleExpandComments(item.id)} activeOpacity={0.75}>
                                    <Text style={[styles.viewAllComments, { color: theme.colors.secondary }]}>
                                        Tüm {commentCount} yorumu gör...
                                    </Text>
                                </TouchableOpacity>
                            )
                        )}

                        {/* Inline comment composer when expanded */}
                        {expandedPosts[item.id] && (
                            <View style={styles.inlineCommentInputRow}>
                                <TextInput
                                    placeholder="Yorum yaz..."
                                    placeholderTextColor={theme.colors.textSecondary}
                                    style={[styles.inlineCommentInput, { color: theme.colors.text, backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }]}
                                    value={postNewCommentMap[item.id] || ''}
                                    onChangeText={(text) => setPostNewCommentMap(prev => ({ ...prev, [item.id]: text }))}
                                    onSubmitEditing={() => submitInlineComment(item.id)}
                                />
                                <TouchableOpacity 
                                    onPress={() => submitInlineComment(item.id)}
                                    disabled={isPostingCommentMap[item.id]}
                                    style={styles.inlineCommentSendBtn}
                                >
                                    {isPostingCommentMap[item.id] ? (
                                        <ActivityIndicator size="small" color={theme.colors.primary} />
                                    ) : (
                                        <Ionicons name="send" size={16} color={theme.colors.primary} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    }, [navigation, user, theme, themeMode, likePost, handleDoubleTapLike, handleImagePress, chatMap, favoriteIds, sentHiList, toggleFavorite, handleHiPress, commentPreviewMap, toggleExpandComments, submitInlineComment, expandedPosts, postCommentsMap, postNewCommentMap, isPostingCommentMap]);

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
                data={visiblePosts}
                keyExtractor={item => item.id}
                renderItem={renderPost}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.feedList}
                scrollEventThrottle={16}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={() => (
                    <View style={styles.emptyFeed}>
                        {loading ? (
                            <ActivityIndicator color={theme.colors.primary} />
                        ) : (
                            <Text style={[styles.emptyFeedText, { color: theme.colors.textSecondary }]}>
                                Bu sekmede henüz gönderi yok.
                            </Text>
                        )}
                    </View>
                )}
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
                style={[styles.fabContainer, { shadowColor: theme.colors.primary }]}
                onPress={handlePostCreation}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={theme.gradients.primary}
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
                                    <FallbackImage url={resolveImageUrl(item.avatar, 'avatar')} style={styles.commentAvatar} isAvatar={true} theme={theme} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.commentUser, { color: theme.colors.text }]}>{cleanUsername(item.userName)}</Text>
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

            {/* Hi Button Bottom Sheet Modal */}
            <Modal
                visible={hiSheetVisible}
                transparent
                animationType="slide"
                onRequestClose={() => {
                    setHiSheetVisible(false);
                    setSelectedPostForHi(null);
                }}
            >
                <View style={styles.sheetBackdrop}>
                    <TouchableOpacity 
                        style={StyleSheet.absoluteFill} 
                        onPress={() => {
                            setHiSheetVisible(false);
                            setSelectedPostForHi(null);
                        }} 
                    />
                    <View style={[styles.hiSheetContent, { backgroundColor: theme.colors.backgroundSecondary || '#100720' }]}>
                        <View style={styles.hiSheetHandle} />
                        
                        <View style={styles.hiSheetHeader}>
                            {selectedPostForHi && (
                                <Image 
                                    source={{ uri: resolveImageUrl(selectedPostForHi.avatar, 'avatar') }} 
                                    style={styles.hiSheetAvatar} 
                                />
                            )}
                            <Text style={[styles.hiSheetTitle, { color: theme.colors.text }]}>
                                {selectedPostForHi ? `${cleanUsername(selectedPostForHi.userName || selectedPostForHi.name)} ile İletişim Kur` : 'İletişim Kur'}
                            </Text>
                            <Text style={styles.hiSheetSubtitle}>Hızlı bir etkileşim başlatın</Text>
                        </View>

                        <View style={styles.hiSheetOptions}>
                            {/* Hızlı Selam Gönder */}
                            <TouchableOpacity 
                                style={[styles.hiOptionItem, { backgroundColor: 'rgba(244, 72, 153, 0.1)', borderColor: 'rgba(244, 72, 153, 0.2)' }]}
                                onPress={() => {
                                    if (selectedPostForHi) {
                                        sendQuickHi(selectedPostForHi);
                                    }
                                }}
                                disabled={isSendingHi}
                            >
                                {isSendingHi ? (
                                    <ActivityIndicator size="small" color="#ec4899" style={{ alignSelf: 'center', width: '100%' }} />
                                ) : (
                                    <>
                                        <View style={[styles.hiOptionIconBg, { backgroundColor: '#ec4899' }]}>
                                            <Ionicons name="hand-left" size={18} color="white" />
                                        </View>
                                        <View style={styles.hiOptionMeta}>
                                            <Text style={[styles.hiOptionLabel, { color: '#fbcfe8' }]}>Hızlı Selam Gönder</Text>
                                            <Text style={styles.hiOptionDesc}>"Merhaba 👋" otomatik mesajı gönderir</Text>
                                        </View>
                                    </>
                                )}
                            </TouchableOpacity>

                            {/* Mesaj Yaz */}
                            <TouchableOpacity 
                                style={[styles.hiOptionItem, { backgroundColor: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.2)' }]}
                                onPress={() => {
                                    if (selectedPostForHi) {
                                        setHiSheetVisible(false);
                                        navigation.navigate('Chat', {
                                            operatorId: selectedPostForHi.operator_id || selectedPostForHi.user_id,
                                            name: cleanUsername(selectedPostForHi.userName || selectedPostForHi.name),
                                            avatar_url: selectedPostForHi.avatar,
                                            vip_level: selectedPostForHi.vipLevel || selectedPostForHi.vip_level || 0,
                                            user
                                        });
                                        setSelectedPostForHi(null);
                                    }
                                }}
                            >
                                <View style={[styles.hiOptionIconBg, { backgroundColor: '#8b5cf6' }]}>
                                    <Ionicons name="chatbubble-ellipses" size={18} color="white" />
                                </View>
                                <View style={styles.hiOptionMeta}>
                                    <Text style={[styles.hiOptionLabel, { color: '#ddd6fe' }]}>Mesaj Yaz</Text>
                                    <Text style={styles.hiOptionDesc}>Sohbet ekranına gidip kendi mesajınızı yazın</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Profili Gör */}
                            <TouchableOpacity 
                                style={[styles.hiOptionItem, { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }]}
                                onPress={() => {
                                    if (selectedPostForHi) {
                                        setHiSheetVisible(false);
                                        navigation.navigate('OperatorProfile', { 
                                            operator: {
                                                ...selectedPostForHi,
                                                id: selectedPostForHi.operator_id || selectedPostForHi.user_id,
                                                name: selectedPostForHi.userName || selectedPostForHi.name,
                                                avatar_url: selectedPostForHi.avatar
                                            }, 
                                            user 
                                        });
                                        setSelectedPostForHi(null);
                                    }
                                }}
                            >
                                <View style={[styles.hiOptionIconBg, { backgroundColor: '#3b82f6' }]}>
                                    <Ionicons name="person" size={18} color="white" />
                                </View>
                                <View style={styles.hiOptionMeta}>
                                    <Text style={[styles.hiOptionLabel, { color: '#dbeafe' }]}>Profili Gör</Text>
                                    <Text style={styles.hiOptionDesc}>Kullanıcının detaylı profilini inceleyin</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
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
        paddingBottom: 118,
    },
    feedHeaderWrap: {
        paddingTop: 42,
        paddingBottom: 8,
        overflow: 'hidden',
    },
    referenceHeaderBg: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 115,
    },
    confettiDot: {
        position: 'absolute',
        width: 4,
        height: 4,
        borderRadius: 2,
        opacity: 0.75,
    },
    stadiumArc: {
        position: 'absolute',
        left: -32,
        right: -32,
        top: 3,
        height: 72,
        borderTopWidth: 2,
        borderColor: 'rgba(148, 163, 184, 0.18)',
        borderRadius: 160,
    },
    feedTopBar: {
        minHeight: 48,
        paddingLeft: 0,
        paddingRight: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    feedTabs: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    feedTabButton: {
        minWidth: 86,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    feedTabText: {
        fontSize: 19,
        fontWeight: '600',
    },
    feedTabTextActive: {
        fontWeight: '900',
    },
    feedTabIndicator: {
        width: 10,
        height: 6,
        borderRadius: 3,
        marginTop: 6,
    },
    notificationButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    emptyFeed: {
        minHeight: 180,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    emptyFeedText: {
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
    },
    storiesContainer: {
        borderBottomWidth: 1,
    },
    storiesList: {
        paddingHorizontal: 12,
        paddingVertical: 2,
    },
    storyContainer: {
        alignItems: 'center',
        marginHorizontal: 10,
    },
    addStoryContainer: {
        width: 60,
        height: 60,
        position: 'relative',
    },
    instagramAddBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
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
        bottom: 65,
        right: 12,
        borderRadius: 32,
        elevation: 8,
        shadowColor: '#A855F7',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.28,
        shadowRadius: 6,
        zIndex: 50,
    },
    fabGradient: {
        width: 64,
        height: 64,
        borderRadius: 32,
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
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0,
    },
    featuredContainer: {
        marginTop: 4,
        marginBottom: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '900',
    },
    seeAll: {
        fontSize: 12,
        fontWeight: '700',
        opacity: 0.8,
    },
    featuredList: {
        paddingHorizontal: 8,
    },
    featuredCard: {
        width: 86,
        borderRadius: 18,
        padding: 8,
        alignItems: 'center',
        marginHorizontal: 4,
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
        padding: 3,
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
        marginTop: 4,
        fontSize: 11,
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
        marginTop: 4,
        fontSize: 11,
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
    // --- RESTRICTURED SOCIAL CARD STYLES ---
    restructuredCard: {
        width: '100%',
        marginHorizontal: 0,
        marginVertical: 0,
        borderRadius: 0,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 20,
        borderWidth: 0,
        borderBottomWidth: 1,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    headerLeftCol: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    headerAvatarContainer: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerMetaCol: {
        flex: 1,
        marginLeft: 10,
    },
    headerNameBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    headerNameText: {
        fontSize: 15,
        fontWeight: '800',
    },
    headerAgeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 8,
        gap: 2,
    },
    headerAgeText: {
        color: 'white',
        fontSize: 9,
        fontWeight: 'bold',
    },
    headerVipBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 6,
    },
    headerVipText: {
        color: 'white',
        fontSize: 8,
        fontWeight: '900',
    },
    headerTimeText: {
        fontSize: 11,
        fontWeight: '400',
        marginTop: 2,
    },
    pillHiButton: {
        borderRadius: 18,
        overflow: 'hidden',
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
    },
    pillHiGradient: {
        paddingHorizontal: 16,
        paddingVertical: 7,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pillHiButtonText: {
        color: 'white',
        fontSize: 11.5,
        fontWeight: '800',
    },
    imageCardContainer: {
        width: width * 0.65,
        height: width * 0.65,
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 10,
        marginBottom: 10,
    },
    restructuredImage: {
        width: '100%',
        height: '100%',
    },
    restructuredCaption: {
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 18,
        marginHorizontal: 2,
        marginBottom: 8,
        maxWidth: width - 56,
    },
    hashtagContainer: {
        flexDirection: 'row',
        marginTop: 2,
        marginBottom: 8,
        marginHorizontal: 2,
    },
    hashtagBadge: {
        backgroundColor: 'rgba(168, 85, 247, 0.08)',
        borderColor: 'rgba(168, 85, 247, 0.15)',
        borderWidth: 0.5,
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 8,
    },
    hashtagText: {
        color: '#a855f7',
        fontSize: 11,
        fontWeight: '700',
    },
    hashtagHash: {
        color: '#d946ef',
        fontWeight: '900',
    },
    restructuredFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
        paddingHorizontal: 2,
        borderTopWidth: 0.5,
        borderTopColor: 'rgba(255,255,255,0.06)',
        paddingTop: 10,
    },
    footerLeftActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
    },
    footerActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
    },
    footerActionText: {
        fontSize: 12,
        fontWeight: '600',
    },
    footerMoreBtn: {
        padding: 4,
    },
    commentPreviewBlock: {
        marginTop: 10,
        paddingHorizontal: 2,
        gap: 4,
    },
    commentPreviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
        gap: 8,
    },
    commentPreviewAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    commentPreviewTextContainer: {
        flex: 1,
        fontSize: 12,
        lineHeight: 16,
    },
    commentPreviewName: {
        fontWeight: '700',
    },
    commentPreviewText: {
        fontWeight: '400',
    },
    viewAllComments: {
        fontSize: 11,
        fontWeight: '700',
        marginTop: 4,
    },
    inlineCommentInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        gap: 8,
    },
    inlineCommentInput: {
        flex: 1,
        height: 36,
        borderRadius: 18,
        paddingHorizontal: 12,
        fontSize: 12,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    inlineCommentSendBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(7, 4, 18, 0.75)',
        justifyContent: 'flex-end',
    },
    hiSheetContent: {
        width: '100%',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        paddingBottom: 40,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    hiSheetHandle: {
        width: 42,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    hiSheetHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    hiSheetAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 2,
        borderColor: '#ec4899',
        marginBottom: 12,
    },
    hiSheetTitle: {
        fontSize: 18,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 4,
    },
    hiSheetSubtitle: {
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: 12,
        fontWeight: '600',
    },
    hiSheetOptions: {
        gap: 12,
    },
    hiOptionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        gap: 14,
    },
    hiOptionIconBg: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hiOptionMeta: {
        flex: 1,
    },
    hiOptionLabel: {
        fontSize: 14,
        fontWeight: '800',
    },
    hiOptionDesc: {
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2,
    },
});