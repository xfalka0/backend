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
import PremiumBackground from '../components/animated/PremiumBackground';
import VipFrame from '../components/ui/VipFrame';
import ModernAlert from '../components/ui/ModernAlert';
import GlassCard from '../components/ui/GlassCard';

const RELATIONSHIP_OPTIONS = ['Ciddi', 'Flörtöz', 'Sohbet', 'Arkadaşlık', 'Evlilik Düşünen'];
const EDU_OPTIONS = ['Lise', 'Üniversite', 'Yüksek Lisans', 'Doktora', 'Öğrenci'];
const ZODIAC_OPTIONS = ['Koç', 'Boğa', 'İkizler', 'Yengeç', 'Aslan', 'Başak', 'Terazi', 'Akrep', 'Yay', 'Oğlak', 'Kova', 'Balık'];
const JOB_OPTIONS = ['Yazılımcı', 'Tasarımcı', 'Öğretmen', 'Mühendis', 'Doktor', 'Avukat', 'Serbest Meslek', 'Diğer'];
// For boy/kilo/age we can use a range or a simple numeric input still, but better to have categories or a specialized picker.
// For now let's focus on the categorical ones as requested.

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

    useEffect(() => {
        floatAnim.value = withRepeat(
            withSequence(
                withTiming(-4, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
    }, []);

    const scrollHandler = useAnimatedScrollHandler((event) => {
        scrollY.value = event.contentOffset.y;
    });

    const headerAnimatedStyle = useAnimatedStyle(() => {
        const height = interpolate(
            scrollY.value,
            [-100, 0, 200],
            [400, 300, 200],
            Extrapolate.CLAMP
        );
        return { height };
    });

    const avatarAnimatedStyle = useAnimatedStyle(() => {
        const scale = interpolate(
            scrollY.value,
            [-100, 0, 200],
            [1.5, 1, 0.8],
            Extrapolate.CLAMP
        );
        const translateY = interpolate(
            scrollY.value,
            [0, 200],
            [0, 20],
            Extrapolate.CLAMP
        );
        return {
            transform: [{ scale }, { translateY }]
        };
    });

    const floatingStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: floatAnim.value }]
    }));

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
        if (isEditingInfo) {
            // Save to backend
            try {
                const response = await axios.put(`${API_URL} /users/${user.id}/profile`, {
                    name: info.name,
                    display_name: info.name,
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
                    setAlert({ visible: true, title: 'Başarılı', message: 'Profil bilgileriniz güncellendi.', type: 'success' });
                }
            } catch (error) {
                console.log('Error saving profile:', error);
                setAlert({ visible: true, title: 'Hata', message: 'Bilgiler kaydedilemedi.', type: 'error' });
            }
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsEditingInfo(!isEditingInfo);
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

    // Boost States
    const [isBoosted, setIsBoosted] = useState(false);
    const [boostEndTime, setBoostEndTime] = useState(null);
    const [showBoostModal, setShowBoostModal] = useState(false);

    const handleContact = () => {
        setShowContactModal(true);
    };

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

                // Fetch Boost Status
                axios.get(`${API_URL}/boosts/status/${user.id}`)
                    .then(res => {
                        setIsBoosted(res.data.isBoosted);
                        if (res.data.isBoosted) setBoostEndTime(res.data.endTime);
                    })
                    .catch(err => console.log('Fetch boost status err:', err));

                // Fetch operator album photos ONLY if user is an operator or admin
                if (user.role === 'operator' || user.role === 'admin' || user.role === 'super_admin') {
                    axios.get(`${API_URL}/operators/${user.id}`)
                        .then(res => {
                            if (res.data.photos && Array.isArray(res.data.photos)) {
                                setAlbum(res.data.photos);
                                setPendingAlbumPhotos([]);
                            }
                        })
                        .catch(err => {
                            // Backend now handles this gracefully, but we log just in case
                            if (err.response?.status !== 404) {
                                console.log('Fetch operator photos error:', err.message);
                            }
                        });
                }
            }
        }, [user?.id, user?.role, profileAvatar])
    );

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
        if (balance < 100) {
            setShowBoostModal(false);
            setAlert({ visible: true, title: 'Yetersiz Bakiye', message: 'Öne çıkmak için en az 100 Coin gereklidir.', type: 'error' });
            return;
        }

        try {
            const res = await axios.post(`${API_URL}/boosts/${user.id}`, { durationMinutes: 30, cost: 100 });
            setBalance(res.data.newBalance);
            setIsBoosted(true);
            setBoostEndTime(res.data.endTime);
            setShowBoostModal(false);
            setAlert({ visible: true, title: 'Başarı', message: 'Profiliniz 30 dakika boyunca öne çıkarıldı!', type: 'success' });
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
                console.error('Album Upload Error Detail:', error.response?.data || error.message);
                setPendingAlbumPhotos(pendingAlbumPhotos.filter(u => u !== uri));
                const errorMsg = error.response?.data?.error || 'Fotoğraf yüklenemedi.';
                setAlert({ visible: true, title: 'Hata', message: errorMsg, type: 'error' });
            }
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Background Layer */}
            {themeMode === 'dark' ? (
                <PremiumBackground />
            ) : (
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    <LinearGradient
                        colors={['#f8fafc', '#f1f5f9']}
                        style={StyleSheet.absoluteFill}
                    />
                </View>
            )}

            <Animated.ScrollView
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                style={styles.scrollView}
            >
                {/* Parallax Header */}
                <Animated.View style={[styles.parallaxHeader, headerAnimatedStyle]}>
                    <LinearGradient
                        colors={vipLevel > 0 ? [vipColors[0], vipColors[1]] : (themeMode === 'dark' ? ['#1e293b', '#0f172a'] : ['#e2e8f0', '#f1f5f9'])}
                        style={styles.parallaxBg}
                    />

                    <View style={styles.settingsIconWrapper}>
                        <TouchableOpacity onPress={() => navigation.navigate('Settings', { user })}>
                            <Ionicons name="settings-outline" size={26} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    <Animated.View style={[styles.avatarContainer, avatarAnimatedStyle]}>
                        {/* Extremely subtle Radial Glow using LinearGradient */}
                        <LinearGradient
                            colors={['rgba(168, 85, 247, 0.15)', 'transparent']}
                            style={styles.avatarRadialGlow}
                            start={{ x: 0.5, y: 0.5 }}
                            end={{ x: 1, y: 1 }}
                        />

                        <Animated.View style={floatingStyle}>
                            <VipFrame
                                level={vipLevel}
                                avatar={profileAvatar}
                                size={120}
                            />
                        </Animated.View>
                        {isAvatarPending && (
                            <View style={styles.pendingOverlay}>
                                <Text style={styles.pendingText}>Onay Bekliyor</Text>
                            </View>
                        )}
                        <TouchableOpacity
                            style={[styles.editBadge, { backgroundColor: theme.colors.primary, borderColor: theme.colors.background }]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                pickAvatar();
                            }}
                        >
                            <Ionicons name="camera" size={20} color="white" />
                        </TouchableOpacity>
                    </Animated.View>

                    <Text style={[styles.userName, { color: theme.colors.text }]}>{info.name}</Text>
                    <View style={styles.jobBadge}>
                        <Ionicons name="briefcase" size={14} color={theme.colors.primary} />
                        <Text style={[styles.jobText, { color: theme.colors.textSecondary }]}>{info.job}</Text>
                    </View>
                </Animated.View>

                {/* Content Sections */}
                <View style={styles.contentWrapper}>
                    {/* Boost Section */}
                    {isBoosted ? (
                        <View style={styles.sectionContainer}>
                            <LinearGradient
                                colors={['rgba(236, 72, 153, 0.15)', 'rgba(139, 92, 246, 0.15)']}
                                style={styles.boostActiveContainer}
                            >
                                <View style={styles.boostActiveHeader}>
                                    <Ionicons name="rocket" size={24} color="#ec4899" />
                                    <Text style={[styles.boostActiveTitle, { color: theme.colors.text }]}>Profilin Öne Çıkarıldı!</Text>
                                </View>
                                <Text style={styles.boostActiveDesc}>Profilin şu anda keşfet bölümünde daha üst sıralarda gösteriliyor.</Text>
                            </LinearGradient>
                        </View>
                    ) : (
                        <View style={styles.sectionContainer}>
                            <TouchableOpacity activeOpacity={0.9} onPress={() => setShowBoostModal(true)}>
                                <LinearGradient
                                    colors={['#ec4899', '#8b5cf6']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                    style={styles.boostPromoContainer}
                                >
                                    <View style={styles.boostPromoIcon}>
                                        <Ionicons name="rocket" size={28} color="white" />
                                    </View>
                                    <View style={styles.boostPromoTextWrapper}>
                                        <Text style={styles.boostPromoTitle}>Profilini Öne Çıkar!</Text>
                                        <Text style={styles.boostPromoDesc}>30 dakika boyunca keşfette en üstte yer alarak daha fazla etkileşim kazan.</Text>
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Wallet Section */}
                    <View style={styles.sectionContainer}>
                        <LinearGradient
                            colors={getWalletBg()}
                            style={[styles.premiumInfoCard, { padding: 24, borderRadius: 30 }]}
                        >
                            <View style={styles.walletHeader}>
                                <View style={styles.walletLabel}>
                                    <Ionicons name="wallet-outline" size={16} color="#fbbf24" />
                                    <Text style={styles.walletLabelText}>CÜZDAN</Text>
                                </View>
                                <View style={styles.statusBadge}>
                                    <View style={[styles.statusDot, { backgroundColor: vipLevel > 0 ? '#10b981' : '#64748b' }]} />
                                    <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>{vipLevel > 0 ? 'PREMIUM' : 'STANDART'}</Text>
                                </View>
                            </View>

                            <View style={styles.walletBalanceRow}>
                                <View>
                                    <Text style={[styles.balanceNum, { color: theme.colors.text }]}>{balance}</Text>
                                    <Text style={[styles.balanceLabel, { color: theme.colors.textSecondary }]}>Kullanılabilir Coin</Text>
                                </View>
                                <Image source={require('../../assets/gold_coin_3f.png')} style={styles.coinImgLarge} resizeMode="contain" />
                            </View>

                            <View style={styles.walletActions}>
                                <TouchableOpacity
                                    style={styles.actionBtn}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        navigation.navigate('Shop', { initialTab: 'coins', user: { ...user, balance } });
                                    }}
                                >
                                    <LinearGradient colors={['#fbbf24', '#f59e0b']} style={styles.btnGradient}>
                                        <Text style={styles.btnText}>Yükle</Text>
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.actionBtn}
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        navigation.navigate('Vip', { userVip: vipLevel, user: { ...user, ...info, balance, vip_level: vipLevel, profile_image: profileAvatar } });
                                    }}
                                >
                                    <LinearGradient colors={['#8b5cf6', '#7c3aed']} style={styles.btnGradient}>
                                        <Text style={styles.btnText}>VIP Al</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </View>

                    {/* Bio Section */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.sectionTitleRow}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Hakkımda</Text>
                            <TouchableOpacity onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                toggleEditInfo(); // Reusing bio edit logic
                                setIsEditingBio(!isEditingBio);
                            }}>
                                <Ionicons name={isEditingBio ? "checkmark" : "create-outline"} size={20} color={theme.colors.primary} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.premiumInfoCard}>
                            {isEditingBio ? (
                                <TextInput
                                    style={[styles.bioInput, { color: theme.colors.text }]}
                                    value={tempBio}
                                    onChangeText={setTempBio}
                                    multiline
                                    maxLength={200}
                                />
                            ) : (
                                <Text style={[styles.bioText, { color: theme.colors.textSecondary }]}>{tempBio}</Text>
                            )}
                        </View>
                    </View>

                    {/* Info Grid Section */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.sectionTitleRow}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Bilgiler</Text>
                            <TouchableOpacity onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                toggleEditInfo();
                            }}>
                                <Ionicons name={isEditingInfo ? "checkmark" : "create-outline"} size={20} color={theme.colors.primary} />
                            </TouchableOpacity>
                        </View>
                        <View style={[styles.premiumInfoCard, styles.infoGrid]}>
                            {[
                                { icon: 'calendar', label: 'Yaş', value: info.age, key: 'age' },
                                { icon: 'briefcase', label: 'İş', value: info.job, key: 'job' },
                                { icon: 'school', label: 'Eğitim', value: info.edu, key: 'edu' },
                                { icon: 'heart', label: 'İlişki', value: info.relationship, key: 'relationship' },
                                { icon: 'sparkles', label: 'Burç', value: info.zodiac, key: 'zodiac' },
                                { icon: 'resize', label: 'Boy', value: info.boy, key: 'boy' },
                                { icon: 'fitness', label: 'Kilo', value: info.kilo, key: 'kilo' },
                            ].map((item, idx) => (
                                <View key={idx} style={styles.gridItem}>
                                    <View style={styles.gridIconWrapper}>
                                        <Ionicons name={item.icon} size={18} color={theme.colors.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.gridLabel}>{item.label}</Text>
                                        {isEditingInfo ? (
                                            <TouchableOpacity
                                                style={[styles.gridValueInputContainer, { borderBottomColor: theme.colors.border }]}
                                                onPress={() => openSelection(item)}
                                            >
                                                <Text style={[styles.gridValue, { color: theme.colors.primary }]}>{item.value || 'Seç...'}</Text>
                                                <Ionicons name="chevron-down" size={14} color={theme.colors.primary} />
                                            </TouchableOpacity>
                                        ) : (
                                            <Text style={[styles.gridValue, { color: theme.colors.text }]}>{item.value}</Text>
                                        )}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Album Section */}
                    <View style={styles.sectionContainer}>
                        <View style={styles.sectionTitleRow}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Fotoğraflar</Text>
                            <Text style={styles.photoCount}>{album.length}/5</Text>
                        </View>
                        <View style={styles.albumScrollWrapper}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albumContent}>
                                {album.map((uri, index) => (
                                    <View key={index} style={styles.albumItem}>
                                        <Image source={{ uri }} style={styles.albumImg} />
                                    </View>
                                ))}
                                {album.length < 5 && (
                                    <Animated.View style={addPhotoAnimatedStyle}>
                                        <TouchableOpacity
                                            style={styles.addPhotoSmall}
                                            activeOpacity={1}
                                            onPressIn={() => {
                                                addPhotoScale.value = withSpring(1.03);
                                            }}
                                            onPressOut={() => {
                                                addPhotoScale.value = withSpring(1);
                                            }}
                                            onPress={() => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                addToAlbum();
                                            }}
                                        >
                                            <Ionicons name="add" size={32} color="rgba(255,255,255,0.3)" />
                                            <Text style={styles.addPhotoTitle}>Fotoğraf ekle</Text>
                                            <Text style={styles.addPhotoSub}>Fotoğraf ekleyen profiller %40 daha fazla eşleşme alır</Text>
                                        </TouchableOpacity>
                                    </Animated.View>
                                )}
                            </ScrollView>
                        </View>
                    </View>

                    {/* Social Menu */}
                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 12 }]}>Sosyal Özellikler</Text>
                        <View style={styles.premiumInfoCard}>
                            <TouchableOpacity
                                style={styles.socialBtn}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    navigation.navigate('Favorites', { user });
                                }}
                            >
                                <View style={styles.socialIconContainer}>
                                    <Ionicons name="heart" size={20} color="#ef4444" />
                                </View>
                                <View style={styles.socialTextContainer}>
                                    <Text style={[styles.socialTitle, { color: theme.colors.text }]}>Favorilerim</Text>
                                    <Text style={styles.socialDesc}>Senin beğendiğin kişiler</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.colors.border} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.socialBtn}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    navigation.navigate('WhoFavoritedMe', { user });
                                }}
                            >
                                <View style={styles.socialIconContainer}>
                                    <Ionicons name="star" size={20} color="#fcd34d" />
                                </View>
                                <View style={styles.socialTextContainer}>
                                    <Text style={[styles.socialTitle, { color: theme.colors.text }]}>Gizli Hayranlar</Text>
                                    <Text style={styles.socialDesc}>Seni favorilere ekleyenler</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.colors.border} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.socialBtn, { borderBottomWidth: 0, paddingBottom: 0 }]}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    navigation.navigate('ProfileVisitors', { user });
                                }}
                            >
                                <View style={styles.socialIconContainer}>
                                    <Ionicons name="eye" size={20} color="#3b82f6" />
                                </View>
                                <View style={styles.socialTextContainer}>
                                    <Text style={[styles.socialTitle, { color: theme.colors.text }]}>Profil Ziyaretçileri</Text>
                                    <Text style={styles.socialDesc}>Profiline kimler baktı?</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.colors.border} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Footer Buttons */}
                    <View style={styles.footerBtns}>
                        <TouchableOpacity style={[styles.footerBtn, { backgroundColor: theme.colors.card }]} onPress={() => setShowContactModal(true)}>
                            <Ionicons name="chatbubble-ellipses" size={20} color={theme.colors.primary} />
                            <Text style={[styles.footerBtnText, { color: theme.colors.text }]}>Destek İsteyin</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.footerBtn,
                                styles.logoutBtnModern,
                                { backgroundColor: isLogoutPressed ? 'rgba(255, 80, 80, 0.08)' : 'transparent' }
                            ]}
                            onPressIn={() => setIsLogoutPressed(true)}
                            onPressOut={() => setIsLogoutPressed(false)}
                            onPress={async () => {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                                await AsyncStorage.clear();
                                navigation.replace('Welcome');
                            }}
                            activeOpacity={1}
                        >
                            <Ionicons name="log-out-outline" size={20} color="rgba(255,80,80,0.9)" />
                            <Text style={styles.logoutBtnText}>Oturumu Kapat</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={{ height: 100 }} />
                </View>
            </Animated.ScrollView>

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

                            <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                <LinearGradient
                                    colors={['rgba(236,72,153,0.2)', 'rgba(139,92,246,0.2)']}
                                    style={{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
                                >
                                    <Ionicons name="rocket" size={40} color="#ec4899" />
                                </LinearGradient>
                                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Öne Çık!</Text>
                                <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>
                                    30 dakika boyunca daha fazla kişinin seni görmesini sağla.
                                </Text>
                            </View>

                            <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: 16, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>Tutar</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={{ color: '#fbbf24', fontSize: 20, fontWeight: '900' }}>100</Text>
                                    <Image source={require('../../assets/gold_coin_3f.png')} style={{ width: 20, height: 20 }} />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}
                                onPress={handleActivateBoost}
                            >
                                <LinearGradient colors={['#ec4899', '#8b5cf6']} style={{ paddingVertical: 18, alignItems: 'center' }}>
                                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '800' }}>{balance >= 100 ? 'Onayla ve Öne Çık' : 'Yetersiz Bakiye - Yükle'}</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowBoostModal(false)}>
                                <Text style={[styles.modalCancelText, { color: theme.colors.textSecondary }]}>Vazgeç</Text>
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
        borderBottomLeftRadius: 50,
        borderBottomRightRadius: 50,
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
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
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
        fontSize: 28,
        fontWeight: '900',
        marginTop: 15,
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
        paddingHorizontal: 20,
        paddingTop: 30,
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
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    modernWalletCard: {
        padding: 24,
        borderRadius: 30,
        // Premium Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 5,
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
        fontSize: 42,
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
        padding: 20,
        borderRadius: 24,
        // Premium Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 5,
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
        fontSize: 15, // larger
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
});
