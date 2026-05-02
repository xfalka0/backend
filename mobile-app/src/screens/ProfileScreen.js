import { useFocusEffect } from '@react-navigation/native';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
    Alert, LayoutAnimation, UIManager, Platform, Modal, TextInput, Linking,
    Dimensions
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedScrollHandler,
    interpolate,
    Extrapolate,
    withSpring,
    withRepeat,
    withTiming,
    withSequence,
    withDelay,
    Easing
} from 'react-native-reanimated';
import React, { useState, useCallback, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';
import { API_URL } from '../config';
import { resolveImageUrl } from '../utils/imageUtils';
import TypingIndicator from '../components/animated/TypingIndicator';
import ChatBackground from '../components/animated/ChatBackground';
import VipFrame from '../components/ui/VipFrame';
import ModernAlert from '../components/ui/ModernAlert';
import GlassCard from '../components/ui/GlassCard';
import BoostPromoCard from '../components/home/BoostPromoCard';

const RELATIONSHIP_OPTIONS = ['Ciddi', 'Flörtöz', 'Sohbet', 'Arkadaşlık', 'Evlilik Düşünen'];
const EDU_OPTIONS = ['Lise', 'Üniversite', 'Yüksek Lisans', 'Doktora', 'Öğrenci'];
const ZODIAC_OPTIONS = ['Koç', 'Boğa', 'İkizler', 'Yengeç', 'Aslan', 'Başak', 'Terazi', 'Akrep', 'Yay', 'Oğlak', 'Kova', 'Balık'];
const JOB_OPTIONS = ['Yazılımcı', 'Tasarımcı', 'Öğretmen', 'Mühendis', 'Doktor', 'Avukat', 'Serbest Meslek', 'Diğer'];

export default function ProfileScreen({ route, navigation }) {
    const { theme, themeMode } = useTheme();
    const { user } = route.params || {};

    const [isEditingBio, setIsEditingBio] = useState(false);
    const [tempBio, setTempBio] = useState(user?.bio || 'Buraya kısa bir açıklama ekleyebilirsiniz.');
    const [album, setAlbum] = useState([]);
    const [pendingAlbumPhotos, setPendingAlbumPhotos] = useState([]);
    const TEST_USER_ID = 'c917f7d6-cc44-4b04-8917-1dbbed0b1e9b';
    const [profileAvatar, setProfileAvatar] = useState(user?.avatar_url || user?.avatar || 'https://i.pravatar.cc/300?img=12');
    const [isAvatarPending, setIsAvatarPending] = useState(false);

    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [info, setInfo] = useState({
        name: user.display_name || user.name || 'Misafir',
        age: (user.age || '28').toString(),
        job: user.job || 'Yazılımcı',
        relationship: user.relationship || 'Sohbet',
        zodiac: user.zodiac || 'Aslan',
        edu: user.edu || 'Üniversite',
        boy: user.boy || '175',
        kilo: user.kilo || '70'
    });

    const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info' });
    const [selectionModal, setSelectionModal] = useState({ visible: false, title: '', options: [], key: '', value: '' });

    const scrollY = useSharedValue(0);
    const floatAnim = useSharedValue(0);
    const boostScale = useSharedValue(1);
    const walletCoinScale = useSharedValue(1);
    const walletCoinRotate = useSharedValue(0);
    const topUpScale = useSharedValue(1);
    const vipBtnScale = useSharedValue(1);

    useEffect(() => {
        floatAnim.value = withRepeat(
            withSequence(
                withTiming(-4, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        walletCoinScale.value = withRepeat(
            withTiming(1.1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );

        walletCoinRotate.value = withRepeat(
            withTiming(10, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const floatingStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: floatAnim.value }],
    }));

    const coinAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: walletCoinScale.value },
            { rotateY: `${walletCoinRotate.value}deg` }
        ],
    }));

    const scrollHandler = useAnimatedScrollHandler((event) => {
        scrollY.value = event.contentOffset.y;
    });

    const headerAnimatedStyle = useAnimatedStyle(() => {
        const height = interpolate(
            scrollY.value,
            [-100, 0, 200],
            [320, 260, 160],
            Extrapolate.CLAMP
        );
        return { height };
    });

    const avatarAnimatedStyle = useAnimatedStyle(() => {
        const scale = interpolate(
            scrollY.value,
            [-100, 0, 200],
            [1.3, 1, 0.75],
            Extrapolate.CLAMP
        );
        const translateY = interpolate(
            scrollY.value,
            [0, 200],
            [0, 10],
            Extrapolate.CLAMP
        );
        return {
            transform: [{ scale }, { translateY }]
        };
    });

    const parseInterests = (data) => {
        if (!data) return ['Spor', 'Müzik'];
        if (Array.isArray(data)) return data;
        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : ['Spor', 'Müzik'];
        } catch (e) {
            return data.toString().split(',').map(s => s.trim());
        }
    };

    const toggleEditInfo = async () => {
        if (isEditingInfo || isEditingBio) {
            // Save to backend
            try {
                const response = await axios.put(`${API_URL}/users/${user.id}/profile`, {
                    name: info.name,
                    display_name: info.name,
                    bio: tempBio,
                    age: parseInt(info.age),
                    job: info.job,
                    relationship: info.relationship,
                    zodiac: info.zodiac,
                    edu: info.edu,
                    boy: info.boy,
                    kilo: info.kilo,
                    interests: JSON.stringify(userInterests)
                });

                if (response.data) {
                    // Update local storage
                    const updatedUser = {
                        ...user,
                        ...response.data
                    };
                    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
                    // We don't necessarily need an alert every time if it's seamless, but let's keep it for now as per original code
                    setAlert({ visible: true, title: 'Başarılı', message: 'Profil bilgileriniz güncellendi.', type: 'success' });
                }
            } catch (error) {
                console.log('Error saving profile:', error);
                setAlert({ visible: true, title: 'Hata', message: 'Bilgiler kaydedilemedi.', type: 'error' });
            }
        }
        setIsEditingInfo(!isEditingInfo);
        setIsEditingBio(!isEditingBio);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };

    const openSelection = (item) => {
        let options = [];
        if (item.key === 'relationship') options = RELATIONSHIP_OPTIONS;
        else if (item.key === 'edu') options = EDU_OPTIONS;
        else if (item.key === 'zodiac') options = ZODIAC_OPTIONS;
        else if (item.key === 'job') options = JOB_OPTIONS;
        else if (item.key === 'age') {
            // Generate ages 18-99
            for (let i = 18; i <= 99; i++) options.push(i.toString());
        } else if (item.key === 'boy') {
            // Generate heights 140-220
            for (let i = 140; i <= 220; i++) options.push(i.toString());
        } else if (item.key === 'kilo') {
            // Generate weights 40-150
            for (let i = 40; i <= 150; i++) options.push(i.toString());
        }

        setSelectionModal({
            visible: true,
            title: `${item.label} Seçin`,
            options,
            key: item.key,
            value: item.value
        });
    };

    const handleSelect = (val) => {
        setInfo(prev => ({ ...prev, [selectionModal.key]: val }));
        setSelectionModal({ ...selectionModal, visible: false });
        Haptics.selectionAsync();
    };

    const [isEditingInterests, setIsEditingInterests] = useState(false);
    const [userInterests, setUserInterests] = useState(parseInterests(user.interests));
    const [tempInterest, setTempInterest] = useState('');
    const [balance, setBalance] = useState(user.balance !== undefined ? user.balance : 100);
    const [vipLevel, setVipLevel] = useState(user.vip_level || 0);
    const [showContactModal, setShowContactModal] = useState(false);
    const [isLogoutPressed, setIsLogoutPressed] = useState(false);

    const addPhotoScale = useSharedValue(1);

    const addPhotoAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: addPhotoScale.value }]
    }));

    const [isBoosted, setIsBoosted] = useState(false);
    const [boostEndTime, setBoostEndTime] = useState(null);
    const [showBoostModal, setShowBoostModal] = useState(false);

    // Agency States
    const [agencyName, setAgencyName] = useState(null);
    const [showAgencyModal, setShowAgencyModal] = useState(false);
    const [agencyCode, setAgencyCode] = useState('');
    const [isJoiningAgency, setIsJoiningAgency] = useState(false);

    const handleContact = () => {
        setShowContactModal(true);
    };

    // Handle editMode from navigation
    useEffect(() => {
        if (route.params?.editMode) {
            setIsEditingInfo(true);
            setIsEditingBio(true);
            // Clear the param so it doesn't stay in edit mode forever
            navigation.setParams({ editMode: undefined });
        }
    }, [route.params?.editMode]);

    // Fetch latest balance, VIP, and approved photos on Focus
    useFocusEffect(
        useCallback(() => {
            if (user?.id) {
                // Fetch basic user data
                axios.get(`${API_URL}/users/${user.id}`)
                    .then(async (res) => {
                        const updatedData = res.data;
                        if (updatedData.balance !== undefined) setBalance(updatedData.balance);
                        if (updatedData.vip_level !== undefined) setVipLevel(updatedData.vip_level);
                        if (updatedData.interests) setUserInterests(parseInterests(updatedData.interests));
                        if (updatedData.album) setAlbum(updatedData.album); // Sync album
                        if (updatedData.edu) setInfo(prev => ({ ...prev, edu: updatedData.edu }));
                        if (updatedData.boy) setInfo(prev => ({ ...prev, boy: updatedData.boy }));
                        if (updatedData.kilo) setInfo(prev => ({ ...prev, kilo: updatedData.kilo }));
                        if (updatedData.age) setInfo(prev => ({ ...prev, age: updatedData.age.toString() }));
                        if (updatedData.job) setInfo(prev => ({ ...prev, job: updatedData.job }));
                        if (updatedData.relationship) setInfo(prev => ({ ...prev, relationship: updatedData.relationship }));
                        if (updatedData.zodiac) setInfo(prev => ({ ...prev, zodiac: updatedData.zodiac }));

                        // Update avatar if approved and changed
                        const newAvatar = updatedData.avatar_url || updatedData.avatar;
                        if (newAvatar && newAvatar !== profileAvatar) {
                            setProfileAvatar(newAvatar);
                            setIsAvatarPending(false);
                        } else if (newAvatar && !updatedData.is_photo_pending) {
                            // If backend says no photo is pending, clear the local pending state
                            setIsAvatarPending(false);
                        }

                        // Also fetch album specifically if not in user object
                        axios.get(`${API_URL}/users/${user.id}/album`)
                            .then(albumRes => {
                                if (albumRes.data) setAlbum(albumRes.data);
                            })
                            .catch(e => console.log('Album fetch error:', e));

                        // CRITICAL: Persist to AsyncStorage so it stays updated after restart
                        try {
                            const currentUserStr = await AsyncStorage.getItem('user');
                            if (currentUserStr) {
                                const currentUser = JSON.parse(currentUserStr);
                                const mergedUser = { ...currentUser, ...updatedData };
                                await AsyncStorage.setItem('user', JSON.stringify(mergedUser));
                                console.log('[Sync] User data persisted to AsyncStorage');
                            }
                        } catch (syncErr) {
                            console.log('[Sync] AsyncStorage error:', syncErr);
                        }
                    })
                    .catch(err => console.log('Fetch user error:', err));

                // Fetch agency info
                axios.get(`${API_URL}/users/${user.id}/agency`)
                    .then(res => {
                        if (res.data && res.data.name) {
                            setAgencyName(res.data.name);
                        }
                    })
                    .catch(err => {
                        // If 404 or no agency, it's fine
                        setAgencyName(null);
                    });
            }
        }, [user?.id, user?.role, profileAvatar])
    );

    const joinAgency = async () => {
        if (!agencyCode.trim()) {
            setAlert({ visible: true, title: 'Hata', message: 'Lütfen geçerli bir ajans kodu girin.', type: 'error' });
            return;
        }

        setIsJoiningAgency(true);
        try {
            const res = await axios.post(`${API_URL}/agencies/join`, { agencyId: agencyCode.trim() });
            if (res.data.success) {
                setAgencyName(res.data.agencyName);
                setShowAgencyModal(false);
                setAlert({ visible: true, title: 'Başarı', message: res.data.message, type: 'success' });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (err) {
            setAlert({ visible: true, title: 'Hata', message: err.response?.data?.error || 'Ajansa katılırken bir hata oluştu.', type: 'error' });
        } finally {
            setIsJoiningAgency(false);
        }
    };

    const getVipColors = (level) => {
        switch (level) {
            case 1: return ['#cd7f32', '#92400e']; // Bronze
            case 2: return ['#cbd5e1', '#64748b']; // Silver
            case 3: return ['#fbbf24', '#b45309']; // Gold
            case 4: return ['#22d3ee', '#164e63']; // Platinum
            case 5: return ['#e879f9', '#be185d']; // Diamond
            case 6: return ['#1a1a1a', '#451a03']; // Obsidian/Gold
            default: return themeMode === 'dark' ? ['#0f172a', '#1e1b4b'] : [theme.colors.background, theme.colors.backgroundSecondary];
        }
    };

    const getWalletBg = () => {
        if (themeMode === 'dark') return ['#1A1435', '#130E26'];
        return [theme.colors.card, theme.colors.backgroundSecondary];
    };

    const handleActivateBoost = async () => {
        if (balance < 1000) {
            setShowBoostModal(false);
            setAlert({ visible: true, title: 'Yetersiz Bakiye', message: 'Öne çıkmak için en az 1000 Coin gereklidir.', type: 'error' });
            return;
        }

        try {
            const res = await axios.post(`${API_URL}/boosts/${user.id}`, { durationMinutes: 1440, cost: 1000 });
            setBalance(res.data.newBalance);
            setIsBoosted(true);
            setBoostEndTime(res.data.endTime);
            setShowBoostModal(false);
            setAlert({ visible: true, title: 'Başarı', message: 'Profiliniz 24 saat boyunca öne çıkarıldı!', type: 'success' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            console.error('Boost error:', err);
            setShowBoostModal(false);
            setAlert({ visible: true, title: 'Hata', message: err.response?.data?.error || 'Öne çıkarma işlemi başarısız oldu.', type: 'error' });
        }
    };

    const vipColors = getVipColors(vipLevel);

    const uploadImage = async (uri) => {
        const formData = new FormData();
        formData.append('file', {
            uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
            type: 'image/jpeg',
            name: 'upload.jpg',
        });

        const res = await axios.post(`${API_URL}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        return res.data.url;
    };

    const pickAvatar = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            setAlert({ visible: true, title: 'İzin Gerekli', message: 'Galerinize erişmek için izin vermeniz gerekiyor.', type: 'warning' });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const oldAvatar = profileAvatar;
            setIsAvatarPending(true);
            setProfileAvatar(uri); // Immediate local preview

            try {
                // 1. Upload to server first
                const serverUrl = await uploadImage(uri);

                // 2. Submit for moderation
                const response = await axios.post(`${API_URL}/moderation/submit`, {
                    userId: user.id || TEST_USER_ID,
                    type: 'avatar',
                    url: serverUrl
                });
                if (response.data.url) {
                    setAlert({ visible: true, title: 'Başarılı', message: 'Profil fotoğrafınız moderasyon onayına gönderildi.', type: 'success' });
                    setIsAvatarPending(true);
                }
            } catch (error) {
                console.error('Avatar Upload Error Detail:', error.response?.data || error.message);
                setIsAvatarPending(false);
                setProfileAvatar(oldAvatar); // Revert on failure
                const errorMsg = error.response?.data?.error || 'Fotoğraf yüklenemedi.';
                setAlert({ visible: true, title: 'Hata', message: errorMsg, type: 'error' });
            }
        }
    };

    const addToAlbum = async () => {
        if (album.length + pendingAlbumPhotos.length >= 5) {
            setAlert({ visible: true, title: 'Limit Doldu', message: 'En fazla 5 fotoğraf ekleyebilirsiniz.', type: 'warning' });
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            setAlert({ visible: true, title: 'İzin Gerekli', message: 'Galerinize erişmek için izin vermeniz gerekiyor.', type: 'warning' });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            setPendingAlbumPhotos([...pendingAlbumPhotos, uri]);
            try {
                // 1. Upload to server first
                const serverUrl = await uploadImage(uri);

                // 2. Submit for moderation
                const response = await axios.post(`${API_URL}/moderation/submit`, {
                    userId: user.id || TEST_USER_ID,
                    type: 'album',
                    url: serverUrl
                });
                if (response.data.url) {
                    setAlert({ visible: true, title: 'Başarılı', message: 'Albüm fotoğrafınız moderasyon onayına gönderildi.', type: 'success' });
                    setPendingAlbumPhotos([...pendingAlbumPhotos, response.data.url]);
                }
            } catch (error) {
                setAlert({ visible: true, title: 'Hata', message: 'Fotoğraf yüklenirken bir sorun oluştu.', type: 'error' });
                setPendingAlbumPhotos(pendingAlbumPhotos.filter(p => p !== uri));
            }
        }
    };

    return (
        <View style={[styles.mainContainer, { backgroundColor: theme.colors.background }]}>
            {/* Chat Style Background Layer */}
            <View style={styles.bgWrapper}>
                <ChatBackground themeMode={themeMode} />
                <LinearGradient 
                    colors={['transparent', 'rgba(15, 5, 26, 0.4)', '#0f051a']} 
                    style={StyleSheet.absoluteFill} 
                    locations={[0, 0.5, 0.9]}
                />
            </View>
            
            {/* Top Action Bar */}
            <View style={styles.topActionsRow}>
                <View style={styles.leftActions}>
                    {/* Buttons removed as requested */}
                </View>
                <View style={styles.rightActions}>
                    <TouchableOpacity style={[styles.iconCircleBtn, { backgroundColor: theme.colors.card }]} onPress={() => pickAvatar()}>
                        <Ionicons name="person-outline" size={20} color={theme.colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconCircleBtn, { backgroundColor: theme.colors.card }]} onPress={() => { setIsEditingInfo(!isEditingInfo); setIsEditingBio(!isEditingBio); }}>
                        <Ionicons name="pencil-outline" size={20} color={theme.colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconCircleBtn, { backgroundColor: theme.colors.card }]} onPress={() => navigation.navigate('Settings', { user })}>
                        <Ionicons name="menu-outline" size={20} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Scrollable Content */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                
                {/* Ribbon */}
                {/* Profile Floating Card */}
                <View style={[styles.profileCard, { backgroundColor: theme.colors.card, alignItems: 'flex-start', paddingTop: 20 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16, width: '100%' }}>
                        <View style={{ position: 'relative' }}>
                            <Image source={{ uri: resolveImageUrl(profileAvatar) }} style={[styles.avatarImage, { width: 100, height: 100, borderRadius: 50, borderColor: theme.colors.card }]} />
                            <View style={[styles.onlineDot, { width: 22, height: 22, borderRadius: 11, bottom: 2, right: 2, borderColor: theme.colors.card }]} />
                        </View>
                        
                        <View style={{ flex: 1 }}>
                            <View style={styles.nameRow}>
                                <Text style={[styles.nameText, { color: theme.colors.text, fontSize: 26 }]}>{info.name}</Text>
                                <View style={styles.onlineBadge}>
                                    <View style={styles.onlineDotSmall} />
                                    <Text style={styles.onlineBadgeText}>Çevrimiçi</Text>
                                </View>
                            </View>
                            
                            {isEditingBio ? (
                                <TextInput
                                    style={[styles.bioInputEdit, { color: theme.colors.text, borderBottomColor: theme.colors.border }]}
                                    value={tempBio}
                                    onChangeText={setTempBio}
                                    multiline
                                    placeholder="Bir şeyler yazın..."
                                    placeholderTextColor={theme.colors.textSecondary}
                                />
                            ) : (
                                <Text style={[styles.bioTextLite, { color: theme.colors.textSecondary, fontSize: 15 }]}>{tempBio}</Text>
                            )}
                        </View>
                    </View>

                    {/* Badges Row Removed */}

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: theme.colors.text }]}>0</Text>
                            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Takipçi</Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: theme.colors.text }]}>0</Text>
                            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Takip et</Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: theme.colors.text }]}>0</Text>
                            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Hediye</Text>
                        </View>
                    </View>
                </View>

                {/* Quick Actions Row */}
                <View style={[styles.quickActionsCard, { backgroundColor: theme.colors.card }]}>
                    <TouchableOpacity style={styles.quickActionItem} onPress={() => setShowAgencyModal(true)}>
                        <View style={[styles.qaIconWrapper, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                            <Ionicons name="business" size={26} color="#3b82f6" />
                        </View>
                        <Text style={[styles.qaLabel, { color: theme.colors.text }]}>Ajans</Text>
                        <Text style={[styles.qaLabel, { color: theme.colors.text }]}>paneli</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.quickActionItem} onPress={() => navigation.navigate('ProfileVisitors', { user })}>
                        <View style={styles.qaBlurredWrapper}>
                            <Image source={{ uri: 'https://i.pravatar.cc/100?img=5' }} style={styles.qaBlurredImage} blurRadius={4} />
                            <Image source={{ uri: 'https://i.pravatar.cc/100?img=6' }} style={[styles.qaBlurredImage, { position: 'absolute', left: 10 }]} blurRadius={4} />
                        </View>
                        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.qaLabel, { color: theme.colors.text }]}>Ziyaretçiler</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.quickActionItem} onPress={() => navigation.navigate('Vip', { userVip: vipLevel, user: { ...user, balance: user?.balance || 0, vip_level: vipLevel, profile_image: profileAvatar } })}>
                        <View style={[styles.qaIconWrapper, { backgroundColor: 'rgba(251, 191, 36, 0.1)' }]}>
                            <Ionicons name="diamond" size={24} color="#fbbf24" />
                        </View>
                        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.qaLabel, { color: theme.colors.text }]}>VIP</Text>
                        <View style={styles.vipIndicator} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.quickActionItem}>
                        <View style={[styles.qaIconWrapper, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                            <Ionicons name="heart" size={26} color="#ec4899" />
                        </View>
                        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.qaLabel, { color: theme.colors.text }]}>Gizli Hayran</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.quickActionItem}>
                        <View style={[styles.qaIconWrapper, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                            <Ionicons name="star" size={26} color="#a855f7" />
                        </View>
                        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.qaLabel, { color: theme.colors.text }]}>Favorilerim</Text>
                    </TouchableOpacity>
                </View>

                {/* Bottom Content Area */}
                <View style={[styles.bottomContentArea, { backgroundColor: theme.colors.card }]}>
                    
                    {/* Wallet Section */}
                    <View style={{ marginBottom: 24, backgroundColor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc', padding: 16, borderRadius: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Image source={require('../../assets/gold_coin_3f.png')} style={{ width: 40, height: 40 }} />
                            <View>
                                <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>Cüzdanım</Text>
                                <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: '900' }}>{balance}</Text>
                            </View>
                        </View>
                        <TouchableOpacity 
                            style={{ backgroundColor: '#fbbf24', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                            onPress={() => navigation.navigate('Shop')}
                        >
                            <Ionicons name="wallet-outline" size={16} color="#422006" />
                            <Text style={{ color: '#422006', fontWeight: '800', fontSize: 14 }}>Yükle</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Boost Section */}
                    <TouchableOpacity 
                        style={{ marginBottom: 24, borderRadius: 20, overflow: 'hidden' }}
                        onPress={() => setShowBoostModal(true)}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={isBoosted ? ['#10b981', '#059669'] : ['#ec4899', '#8b5cf6']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                                    <Ionicons name={isBoosted ? "rocket" : "flash"} size={20} color="white" />
                                </View>
                                <View>
                                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '800' }}>{isBoosted ? "Profilin Öne Çıkarılıyor" : "Profilini Öne Çıkar"}</Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Keşfet'te 10 kat daha fazla görün</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="white" />
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Album Section */}
                    <View style={{ marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.text }}>Albüm</Text>
                            <TouchableOpacity onPress={() => {/* View all */}}><Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '700' }}>Tümünü Gör</Text></TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                            <TouchableOpacity 
                                style={{ width: 80, height: 80, borderRadius: 16, backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderStyle: 'dashed' }}
                                onPress={() => addToAlbum()}
                            >
                                <Ionicons name="add" size={32} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                            {album.map((photo, index) => (
                                <Image key={index} source={{ uri: resolveImageUrl(photo?.url || photo) }} style={{ width: 80, height: 80, borderRadius: 16 }} />
                            ))}
                            {pendingAlbumPhotos.map((uri, index) => (
                                <View key={`pending-${index}`} style={{ width: 80, height: 80, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
                                    <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 16, opacity: 0.6 }} />
                                    <View style={{ position: 'absolute' }}>
                                        <TypingIndicator color="white" />
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Information Section */}
                    <View style={{ marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>Temel Bilgiler</Text>
                            <TouchableOpacity onPress={toggleEditInfo} style={{ backgroundColor: theme.colors.primary + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
                                <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '700' }}>{isEditingInfo ? 'Kaydet' : 'Düzenle'}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {['age', 'job', 'edu', 'boy', 'kilo', 'zodiac', 'relationship'].map((key) => {
                                const labels = { age: 'Yaş', job: 'Meslek', edu: 'Eğitim', boy: 'Boy', kilo: 'Kilo', zodiac: 'Burç', relationship: 'İlişki' };
                                const icons = { age: 'calendar', job: 'briefcase', edu: 'school', boy: 'body', kilo: 'barbell', zodiac: 'star', relationship: 'heart' };
                                const iconColors = { age: '#f59e0b', job: '#3b82f6', edu: '#10b981', boy: '#6366f1', kilo: '#ef4444', zodiac: '#8b5cf6', relationship: '#ec4899' };
                                
                                if (isEditingInfo) {
                                    return (
                                        <TouchableOpacity key={key} onPress={() => openSelection({ key, label: labels[key], value: info[key] })} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                                            <Ionicons name={icons[key]} size={16} color={iconColors[key]} />
                                            <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>{info[key] || 'Seçiniz'}</Text>
                                        </TouchableOpacity>
                                    );
                                }
                                
                                return info[key] ? (
                                    <View key={key} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                                        <Ionicons name={icons[key]} size={16} color={iconColors[key]} />
                                        <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>{info[key]}</Text>
                                    </View>
                                ) : null;
                            })}
                        </View>
                    </View>

                    {/* Social Features Section Removed as it is already in Quick Actions */}

                    {/* Tags / Interests Section */}
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 16 }}>İlgi Alanları</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {userInterests.map((interest, index) => (
                                <View key={index} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(168, 85, 247, 0.12)', borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.25)' }}>
                                    <Text style={{ color: '#a855f7', fontSize: 13, fontWeight: '700' }}>#{interest}</Text>
                                </View>
                            ))}
                            {isEditingInfo && (
                                <TouchableOpacity style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.primary, borderStyle: 'dashed', backgroundColor: theme.colors.primary + '10' }}>
                                    <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '700' }}>+ Ekle</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* ID & Logout Section */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="id-card-outline" size={16} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' }}>ID: {user?.id?.toString()?.substring(0,8) || '110866638'}</Text>
                        </View>
                        <TouchableOpacity 
                            style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                            onPress={async () => {
                                await AsyncStorage.clear();
                                navigation.replace('Welcome');
                            }}
                        >
                            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '800' }}>Çıkış Yap</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{height: 120}} />
                </View>
            </ScrollView>

            <Modal
                visible={showAgencyModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowAgencyModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <BlurView intensity={90} tint="dark" style={styles.modalContent}>
                        <Text style={[styles.modalTitle, { color: 'white' }]}>Ajansa Katıl</Text>
                        <Text style={[styles.modalSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
                            Size verilen ajans kodunu aşağıya girerek bir ekibe dahil olabilirsiniz.
                        </Text>

                        <TextInput
                            style={[styles.agencyInput, { 
                                backgroundColor: 'rgba(255,255,255,0.05)', 
                                borderColor: 'rgba(255,255,255,0.1)',
                                color: 'white'
                            }]}
                            placeholder="Ajans Kodunu Girin (UUID)"
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            value={agencyCode}
                            onChangeText={setAgencyCode}
                            autoCapitalize="none"
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity 
                                style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} 
                                onPress={() => setShowAgencyModal(false)}
                            >
                                <Text style={[styles.modalBtnText, { color: 'white' }]}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalBtn, { backgroundColor: theme.colors.primary, marginLeft: 12 }]} 
                                onPress={joinAgency}
                                disabled={isJoiningAgency}
                            >
                                <Text style={[styles.modalBtnText, { color: 'white' }]}>
                                    {isJoiningAgency ? 'Katılınıyor...' : 'Katıl'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </BlurView>
                </View>
            </Modal>

            <ModernAlert
                visible={alert.visible}
                title={alert.title}
                message={alert.message}
                type={alert.type}
                onClose={() => setAlert({ ...alert, visible: false })}
            />

            {/* BOOST MODAL */}
            <Modal
                visible={showBoostModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowBoostModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowBoostModal(false)} />
                    <View style={[styles.modernModalContainer, { paddingBottom: 40 }]}>
                        <GlassCard intensity={80} tint="dark" noBorder style={styles.modernModalContent}>
                            <View style={styles.modalHeaderIndicator} />

                            <View style={{ alignItems: 'center', marginBottom: 25 }}>
                                <View style={{ height: 140, justifyContent: 'center', alignItems: 'center' }}>
                                    {/* Sub-glow behind rocket */}
                                    <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(236,72,153,0.1)', zIndex: -1 }} />

                                    <Animated.View style={floatingStyle}>
                                        <LinearGradient
                                            colors={['#ec4899', '#8b5cf6', '#6366f1']}
                                            style={{ width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center', shadowColor: '#ec4899', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.6, shadowRadius: 25, elevation: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' }}
                                        >
                                            <Ionicons name="rocket" size={56} color="white" />
                                        </LinearGradient>
                                    </Animated.View>
                                </View>

                                <Text style={[styles.modalTitle, { color: theme.colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }]}>Öne Çık!</Text>
                                <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: 20, fontSize: 14, lineHeight: 20 }]}>
                                    Profilini keşfette en üst sıraya taşıyarak etkileşimini **10 kat** artırabilirsin.
                                </Text>
                            </View>

                            <GlassCard intensity={30} tint="dark" style={{ marginBottom: 25, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                                <View>
                                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 }}>İşlem Tutarı</Text>
                                    <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '900' }}>24 Saat Boost</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(251,191,36,0.15)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 }}>
                                        <Text style={{ color: '#fbbf24', fontSize: 24, fontWeight: '900' }}>1000</Text>
                                        <Image source={require('../../assets/gold_coin_3f.png')} style={{ width: 22, height: 22 }} />
                                    </View>
                                </View>
                            </GlassCard>

                            <TouchableOpacity
                                activeOpacity={0.8}
                                style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 15, elevation: 10, shadowColor: '#ec4899', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 15 }}
                                onPress={handleActivateBoost}
                            >
                                <LinearGradient
                                    colors={['#ec4899', '#8b5cf6', '#6366f1']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{ paddingVertical: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
                                >
                                    <Ionicons name={balance >= 1000 ? "flash" : "cart"} size={22} color="white" />
                                    <Text style={{ color: 'white', fontSize: 18, fontWeight: '900' }}>
                                        {balance >= 1000 ? 'HEMEN AKTİV ET' : 'COİN YÜKLE'}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{ paddingVertical: 10, alignItems: 'center' }}
                                onPress={() => setShowBoostModal(false)}
                            >
                                <Text style={{ color: theme.colors.textSecondary, fontSize: 14, fontWeight: '700' }}>Belki Daha Sonra</Text>
                            </TouchableOpacity>
                        </GlassCard>
                    </View>
                </View>
            </Modal>

            {/* CONTACT MODAL */}
            <Modal
                visible={showContactModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowContactModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowContactModal(false)} />
                    <View style={styles.modernModalContainer}>
                        <GlassCard intensity={80} tint="dark" noBorder style={styles.modernModalContent}>
                            <View style={styles.modalHeaderIndicator} />
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Destek Hattı</Text>
                            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>Size nasıl yardımcı olabiliriz?</Text>

                            <TouchableOpacity
                                style={styles.contactOption}
                                onPress={() => {
                                    setShowContactModal(false);
                                    Linking.openURL('https://wa.me/905000000000'); // Sample WhatsApp
                                }}
                            >
                                <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(37,211,102,0.1)' }]}>
                                    <Ionicons name="logo-whatsapp" size={26} color="#25D366" />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={[styles.optionTitle, { color: theme.colors.text }]}>WhatsApp Destek</Text>
                                    <Text style={styles.optionDescription}>Hızlı ve kolay iletişim</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={theme.colors.border} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.contactOption}
                                onPress={() => {
                                    setShowContactModal(false);
                                    Linking.openURL('mailto:destek@sugo.com');
                                }}
                            >
                                <View style={[styles.optionIconContainer, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                                    <Ionicons name="mail" size={26} color="#3b82f6" />
                                </View>
                                <View style={styles.optionTextContainer}>
                                    <Text style={[styles.optionTitle, { color: theme.colors.text }]}>E-Posta Gönder</Text>
                                    <Text style={styles.optionDescription}>Resmi destek talebi</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={theme.colors.border} />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowContactModal(false)}>
                                <Text style={[styles.modalCancelText, { color: theme.colors.textSecondary }]}>Vazgeç</Text>
                            </TouchableOpacity>
                        </GlassCard>
                    </View>
                </View>
            </Modal>

            {/* SELECTION MODAL */}
            <Modal
                visible={selectionModal.visible}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectionModal({ ...selectionModal, visible: false })}
            >
                <View style={styles.modalOverlay}>
                    <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => setSelectionModal({ ...selectionModal, visible: false })}
                    />
                    <GlassCard intensity={80} tint="dark" noBorder style={styles.selectionModalContent}>
                        <View style={styles.modalHeaderIndicator} />
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{selectionModal.title}</Text>
                        <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                            <View style={styles.optionsGrid}>
                                {selectionModal.options.map((option, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={[
                                            styles.optionBtn,
                                            {
                                                backgroundColor: selectionModal.value === option ? theme.colors.primary : 'rgba(255,255,255,0.05)',
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 8
                                            }
                                        ]}
                                        onPress={() => handleSelect(option)}
                                    >
                                        <Text style={[
                                            styles.optionText,
                                            { color: selectionModal.value === option ? 'white' : theme.colors.text }
                                        ]}>
                                            {option}
                                        </Text>
                                        {selectionModal.value === option && (
                                            <Ionicons name="checkmark-circle" size={16} color="white" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                        <TouchableOpacity
                            style={styles.modalCancelBtn}
                            onPress={() => setSelectionModal({ ...selectionModal, visible: false })}
                        >
                            <Text style={[styles.modalCancelText, { color: theme.colors.textSecondary }]}>Vazgeç</Text>
                        </TouchableOpacity>
                    </GlassCard>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    parallaxHeader: {
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    parallaxBg: {
        ...StyleSheet.absoluteFillObject,
        borderBottomLeftRadius: 35,
        borderBottomRightRadius: 35,
    },
    settingsIconWrapper: {
        position: 'absolute',
        top: 60,
        right: 25,
        zIndex: 10,
    },
    avatarContainer: {
        position: 'relative',
        zIndex: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarRadialGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        zIndex: -1,
    },
    editBadge: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    pendingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pendingText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    userName: {
        fontSize: 22,
        fontWeight: '900',
        marginTop: 10,
        letterSpacing: -0.5,
    },
    jobBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent', // Remove background layer
        paddingHorizontal: 0, // Reset padding
        paddingVertical: 4,
        borderRadius: 15,
        marginTop: 8,
        gap: 6,
    },
    jobText: {
        fontSize: 13,
        fontWeight: '600',
    },
    contentWrapper: {
        paddingHorizontal: 16,
        paddingTop: 20,
    },
    sectionContainer: {
        marginBottom: 25,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    modernWalletCard: {
        padding: 16,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 4,
    },
    walletHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    walletLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    walletLabelText: {
        color: '#fbbf24',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '800',
    },
    walletBalanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
    },
    balanceNum: {
        fontSize: 34,
        fontWeight: '900',
        letterSpacing: -1,
    },
    balanceLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: -4,
    },
    coinImgLarge: {
        width: 80,
        height: 80,
    },
    walletActions: {
        flexDirection: 'row',
        gap: 15,
    },
    actionBtn: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
    },
    btnGradient: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnText: {
        color: 'white',
        fontSize: 15,
        fontWeight: '800',
    },
    premiumInfoCard: {
        padding: 24,
        borderRadius: 30,
        borderWidth: 1,
        borderTopWidth: 1.5,
        overflow: 'hidden',
        // Depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 25,
    },
    infoGlassCard: {
        padding: 16,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 4,
    },
    bioText: {
        fontSize: 14,
        lineHeight: 22,
        fontWeight: '500',
    },
    bioInput: {
        fontSize: 14,
        lineHeight: 22,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 20,
    },
    gridItem: {
        width: '45%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    gridIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridLabel: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        opacity: 0.8,
    },
    gridValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    gridValueInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        // borderBottomColor: theme.colors.border, // Fixed: Moved to dynamic style
        paddingBottom: 2,
        backgroundColor: 'transparent', // Force transparency
    },
    selectionModalContent: {
        borderTopLeftRadius: 35,
        borderTopRightRadius: 35,
        padding: 25,
        paddingBottom: 40,
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
        paddingVertical: 10,
    },
    optionBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        minWidth: '28%',
        alignItems: 'center',
    },
    optionText: {
        fontSize: 14,
        fontWeight: '700',
    },
    photoCount: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    albumScrollWrapper: {
        marginHorizontal: -20,
    },
    albumContent: {
        paddingHorizontal: 20,
        gap: 12,
    },
    albumItem: {
        width: 120,
        height: 160,
        borderRadius: 20,
        overflow: 'hidden',
    },
    albumImg: {
        width: '100%',
        height: '100%',
    },
    addPhotoSmall: {
        width: 120,
        height: 160,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.15)',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent', // Remove internal layer
        padding: 10,
    },
    addPhotoTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 8,
        textAlign: 'center',
    },
    addPhotoSub: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 9,
        textAlign: 'center',
        marginTop: 4,
    },
    footerBtns: {
        gap: 12,
        marginTop: 10,
    },
    footerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        borderRadius: 20,
    },
    footerBtnText: {
        fontSize: 16,
        fontWeight: '700',
    },
    logoutBtnModern: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 80, 80, 0.4)',
    },
    logoutBtnText: {
        color: 'rgba(255, 80, 80, 0.9)',
        fontSize: 16,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)', // Option 1: Darker for better focus
        justifyContent: 'flex-end',
    },
    modernModalContainer: {
        padding: 20,
    },
    modernModalContent: {
        borderRadius: 35,
        padding: 25,
        overflow: 'hidden',
    },
    modalHeaderIndicator: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 25,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 10,
    },
    modalSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 30,
    },
    contactOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 24,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    optionIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionTextContainer: {
        flex: 1,
        marginLeft: 15,
    },
    optionTitle: {
        fontSize: 17,
        fontWeight: '800',
    },
    optionDescription: {
        fontSize: 12,
        opacity: 0.7,
    },
    modalCancelBtn: {
        padding: 15,
        alignItems: 'center',
        marginTop: 10,
    },
    modalCancelText: {
        fontSize: 15,
        fontWeight: '800',
    },
    socialBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    socialIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
        backgroundColor: 'transparent',
    },
    socialTextContainer: {
        flex: 1,
    },
    socialTitle: {
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 2,
    },
    socialDesc: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '500',
    },
    boostPromoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderRadius: 24,
        gap: 16,
        // Premium depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 25,
        elevation: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)', // inner glow
    },
    boostPromoIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'transparent', // Remove background
        alignItems: 'center',
        justifyContent: 'center',
    },
    boostPromoTextWrapper: {
        flex: 1,
    },
    boostPromoTitle: {
        color: 'white',
        fontSize: 19,
        fontWeight: '900',
        marginBottom: 4,
    },
    boostPromoDesc: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        lineHeight: 18,
    },
    boostActiveContainer: {
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(236, 72, 153, 0.3)',
    },
    boostActiveHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    boostActiveTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    boostActiveDesc: {
        color: '#94a3b8',
        fontSize: 13,
        lineHeight: 18,
    },
    contactOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    optionIconContainer: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 17,
        fontWeight: '700',
        marginBottom: 2,
    },
    optionDescription: {
        fontSize: 13,
        color: '#94a3b8',
    },
    // Agency Styles
    agencyRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    agencyIconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(167, 139, 250, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    agencyTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    agencyDesc: {
        fontSize: 12,
        marginTop: 2,
    },
    joinBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
    },
    joinBtnText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 14,
    },
    verifiedBadge: {
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContent: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        padding: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    agencyInput: {
        height: 54,
        borderRadius: 14,
        paddingHorizontal: 16,
        fontSize: 16,
        marginBottom: 20,
        borderWidth: 1,
    },
    modalActions: {
        flexDirection: 'row',
        marginTop: 10,
    },
    modalBtn: {
        flex: 1,
        height: 54,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalBtnText: {
        fontSize: 16,
        fontWeight: '800'
    },
    // --- NEW MODERN ASIAN PROFILE STYLES ---
    mainContainer: { flex: 1 },
    bgWrapper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    desertBg: { width: '100%', height: '100%' },
    topActionsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 10, zIndex: 10 },
    leftActions: { flexDirection: 'row', gap: 8 },
    topBtnYellow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fde047', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
    coinCircle: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#fbbf24' },
    topBtnTextDark: { color: '#422006', fontWeight: '800', fontSize: 13 },
    topBtnPurple: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
    diamondShape: { width: 12, height: 12, backgroundColor: '#c084fc', transform: [{ rotate: '45deg' }] },
    topBtnTextWhite: { color: 'white', fontWeight: '800', fontSize: 13 },
    rightActions: { flexDirection: 'row', gap: 12 },
    iconCircleBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingTop: 20 },
    ribbonWrapper: { alignItems: 'flex-start', paddingHorizontal: 20, marginBottom: 10 },
    yellowRibbon: { backgroundColor: 'rgba(253, 224, 71, 0.9)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
    ribbonText: { color: '#854d0e', fontSize: 12, fontWeight: '700' },
    profileCard: { marginHorizontal: 16, borderRadius: 24, padding: 20, paddingTop: 15, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8, alignItems: 'flex-start' },
    avatarWrapper: { position: 'absolute', top: -35, left: 20 },
    avatarImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 4 },
    onlineDot: { position: 'absolute', bottom: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#10b981', borderWidth: 2, borderColor: 'white' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, marginTop: 10 },
    nameText: { fontSize: 24, fontWeight: '900' },
    onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2 },
    onlineDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
    onlineBadgeText: { color: '#10b981', fontSize: 11, fontWeight: '700' },
    bioInputEdit: { fontSize: 14, minHeight: 40, borderWidth: 0, borderBottomWidth: 1, paddingVertical: 4, marginBottom: 12 },
    bioTextLite: { fontSize: 14, marginBottom: 12 },
    badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
    badgePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    badgePillTextWhite: { color: 'white', fontSize: 11, fontWeight: '700' },
    badgePillTextDark: { fontSize: 11, fontWeight: '700' },
    flagBadge: { justifyContent: 'center' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
    statItem: { flex: 1, alignItems: 'center' },
    statNumber: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
    statLabel: { fontSize: 11 },
    statDivider: { width: 1, height: 24 },
    quickActionsCard: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, borderRadius: 20, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4 },
    quickActionItem: { alignItems: 'center', width: 60 },
    qaIconWrapper: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    qaBlurredWrapper: { width: 44, height: 44, marginBottom: 6, justifyContent: 'center', alignItems: 'center' },
    qaBlurredImage: { width: 36, height: 36, borderRadius: 10 },
    qaCrownIcon: { width: 32, height: 32 },
    qaLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
    vipIndicator: { position: 'absolute', bottom: 18, right: 10, width: 8, height: 4, backgroundColor: '#ec4899', borderRadius: 2 },
    bottomContentArea: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 20, paddingHorizontal: 20, minHeight: 500 },
    tabsRow: { flexDirection: 'row', gap: 24, borderBottomWidth: 1, paddingBottom: 12, marginBottom: 20 },
    activeTab: { alignItems: 'center' },
    activeTabText: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
    activeTabIndicator: { width: 20, height: 3, borderRadius: 2 },
    inactiveTabText: { fontSize: 16, fontWeight: '600' },
    verificationSection: { marginBottom: 24 },
    sectionHeading: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
    verificationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    verifyCard: { width: '48%', flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12 },
    verifyTextGray: { fontSize: 12, fontWeight: '600' },
    verifyTextPink: { fontSize: 12, fontWeight: '600' },
    verifyTextGreen: { fontSize: 12, fontWeight: '600' },
    verifyTextBlue: { fontSize: 12, fontWeight: '600' },
    idSection: { marginBottom: 24 },
    idRow: { flexDirection: 'row', alignItems: 'center' },
    idText: { fontSize: 14, fontWeight: '600' },
    tagSection: { marginBottom: 24 },
    addTagBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
    addTagText: { fontSize: 13, fontWeight: '700' },
    logoutSimpleBtn: { padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 },
    logoutSimpleText: { fontSize: 15, fontWeight: '800' }
});
