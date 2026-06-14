import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Dimensions,
    Platform,
    StatusBar,
    Animated,
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
    Linking
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { resolveImageUrl } from '../utils/imageUtils';
import ImageViewing from 'react-native-image-viewing';
import { useAlert } from '../contexts/AlertContext';
import { useAppStore } from '../store/useAppStore';
import { preventScreenshots } from '../utils/security';
import GlassCard from '../components/ui/GlassCard';

const { width } = Dimensions.get('window');

const ProfileScreen = ({ route }) => {
    const navigation = useNavigation();
    const { theme, themeMode } = useTheme();
    const { showAlert } = useAlert();
    const [user, setUser] = useState(route?.params?.user || {});
    const [loading, setLoading] = useState(false);
    const [balance, setBalance] = useState(user?.balance || user?.coins || user?.hearts || 0);
    const [userPhotos, setUserPhotos] = useState(user?.photos || []);
    const [pendingPhotos, setPendingPhotos] = useState([]);
    const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingSection, setEditingSection] = useState(null); // 'basic', 'interests'
    const [tempBio, setTempBio] = useState('');
    const [isEditingBio, setIsEditingBio] = useState(false);
    const scrollY = new Animated.Value(0);
    const [operatorStats, setOperatorStats] = useState(null);
    const [pendingInvitations, setPendingInvitations] = useState([]);

    // Zustand Role & Cihaz Güvenliği
    const role = useAppStore(state => state.role);
    const isOperator = role === 'operator';

    useEffect(() => {
        if (isOperator) {
            preventScreenshots(true);
        }
        return () => {
            if (isOperator) {
                preventScreenshots(false);
            }
        };
    }, [isOperator]);

    const editOptions = {
        job: ["Yazılımcı", "Öğrenci", "Mühendis", "Doktor", "Tasarımcı", "Sanatçı", "Serbest Meslek", "Diğer"],
        edu: ["Lise", "Ön Lisans", "Üniversite", "Yüksek Lisans", "Doktora"],
        zodiac: ["Koç", "Boğa", "İkizler", "Yengeç", "Aslan", "Başak", "Terazi", "Akrep", "Yay", "Oğlak", "Kova", "Balık"],
        relationship: ["Sohbet", "Ciddi İlişki", "Arkadaşlık", "Evlilik", "Sadece Takılma"],
        interests: ["Müzik", "Spor", "Seyahat", "Kitap", "Sinema", "Dans", "Oyun", "Sanat", "Doğa", "Fotoğraf", "Yazılım", "Yoga", "Kamp"],
        boy: Array.from({ length: 71 }, (_, i) => `${140 + i}`),
        kilo: Array.from({ length: 101 }, (_, i) => `${40 + i}`)
    };

    // Sync user data on focus
    useFocusEffect(
        React.useCallback(() => {
            const syncUserData = async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    if (!token) return;

                    let profileData = null;
                    let balanceData = null;

                    const [profileRes, balRes, pendingRes] = await Promise.all([
                        axios.get(`${API_URL}/users/${user.id}`, { headers: { Authorization: `Bearer ${token}` } }),
                        axios.get(`${API_URL}/users/${user.id}/balance`, { headers: { Authorization: `Bearer ${token}` } }),
                        axios.get(`${API_URL}/users/${user.id}/pending-photos`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
                    ]);

                    profileData = profileRes.data;
                    balanceData = balRes.data;
                    const pendingData = pendingRes.data || [];
                    setPendingPhotos(pendingData);

                    if (profileData) {
                        const updatedUser = { ...user, ...profileData };
                        setUser(updatedUser);
                        if (profileData.photos) {
                            setUserPhotos(profileData.photos);
                        }
                        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
                        
                        const profileBalance = updatedUser.balance ?? updatedUser.coins ?? updatedUser.hearts;
                        if (profileBalance !== undefined) setBalance(profileBalance);

                        // Fetch operator balance stats if they are operator staff or female
                        if (['operator', 'moderator', 'admin', 'super_admin', 'staff'].includes(profileData.role) || profileData.gender === 'kadin') {
                            try {
                                const opRes = await axios.get(`${API_URL}/operators/my/stats`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                if (opRes.data) {
                                    setOperatorStats(opRes.data);
                                }
                            } catch (opErr) {
                                console.log('Error fetching operator stats:', opErr.message);
                            }
                        }

                        // Fetch pending agency invitations if user is female/publisher
                        if (profileData.gender === 'kadin') {
                            try {
                                const inviteRes = await axios.get(`${API_URL}/agency/my-invitations`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                if (inviteRes.data) {
                                    setPendingInvitations(inviteRes.data);
                                }
                            } catch (invErr) {
                                console.log('Error fetching pending invitations:', invErr.message);
                            }
                        }
                    }

                    if (balanceData) {
                        const newBalance = balanceData.balance ?? balanceData.coins ?? balanceData.hearts ?? balance;
                        setBalance(newBalance);
                    }
                } catch (error) {
                    console.error('Sync error:', error);
                }
            };
            syncUserData();
        }, [])
    );

    const handleAcceptInvitation = async (inviteId) => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const res = await axios.post(`${API_URL}/agency/invitations/${inviteId}/accept`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data && res.data.success) {
                showAlert({
                    title: 'Başarılı',
                    message: res.data.message || 'Ajans davetini başarıyla kabul ettiniz! Artık bu ajansın resmi yayıncısısınız.',
                    type: 'success'
                });
                // Reset role in Zustand
                const userRes = await axios.get(`${API_URL}/users/${user.id}`, { headers: { Authorization: `Bearer ${token}` } });
                if (userRes.data) {
                    const updatedUser = { ...user, ...userRes.data };
                    setUser(updatedUser);
                    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
                    
                    // Update Zustand store
                    const setUserState = useAppStore.getState().setUser;
                    if (setUserState) setUserState(updatedUser);
                }
                setPendingInvitations([]);
            } else {
                showAlert({
                    title: 'Hata',
                    message: res.data?.error || 'Davet kabul edilemedi.',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('[ProfileScreen] Accept invite error:', error);
            const errMsg = error.response?.data?.error || 'Davet kabul edilirken bir hata oluştu.';
            showAlert({
                title: 'Hata',
                message: errMsg,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleRejectInvitation = async (inviteId) => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token');
            if (!token) return;

            const res = await axios.post(`${API_URL}/agency/invitations/${inviteId}/reject`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data && res.data.success) {
                showAlert({
                    title: 'Başarılı',
                    message: 'Ajans davetini reddettiniz.',
                    type: 'success'
                });
                // Remove from pending state list
                setPendingInvitations(prev => prev.filter(inv => inv.id !== inviteId));
            } else {
                showAlert({
                    title: 'Hata',
                    message: res.data?.error || 'Davet reddedilemedi.',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('[ProfileScreen] Reject invite error:', error);
            const errMsg = error.response?.data?.error || 'Davet reddedilirken bir hata oluştu.';
            showAlert({
                title: 'Hata',
                message: errMsg,
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const pickAvatar = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showAlert({
                title: 'İzin Gerekli',
                message: 'Profil fotoğrafınızı değiştirmek için galeri iznine ihtiyacımız var.',
                type: 'warning'
            });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            setLoading(true);
            try {
                const uri = result.assets[0].uri;
                const formData = new FormData();
                formData.append('file', {
                    uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
                    type: 'image/jpeg',
                    name: `avatar_${user.id}_${Date.now()}.jpg`,
                });

                const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (uploadRes.data && uploadRes.data.url) {
                    await axios.post(`${API_URL}/moderation/submit`, {
                        userId: user.id,
                        type: 'avatar',
                        url: uploadRes.data.url
                    });

                    showAlert({
                        title: 'Başarılı',
                        message: 'Profil fotoğrafınız moderasyon onayına gönderildi.',
                        type: 'success'
                    });
                }
            } catch (e) {
                console.error('Avatar upload error:', e);
                showAlert({
                    title: 'Hata',
                    message: 'Fotoğraf yüklenirken bir sorun oluştu.',
                    type: 'error'
                });
            } finally {
                setLoading(false);
            }
        }
    };

    const pickAlbumPhoto = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showAlert({
                title: 'İzin Gerekli',
                message: 'Fotoğraf eklemek için galeri iznine ihtiyacımız var.',
                type: 'warning'
            });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.7,
        });

        if (!result.canceled) {
            setLoading(true);
            try {
                const uri = result.assets[0].uri;
                const formData = new FormData();
                formData.append('file', {
                    uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
                    type: 'image/jpeg',
                    name: `album_${user.id}_${Date.now()}.jpg`,
                });

                const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (uploadRes.data && uploadRes.data.url) {
                    await axios.post(`${API_URL}/moderation/submit`, {
                        userId: user.id,
                        type: 'album',
                        url: uploadRes.data.url
                    });

                    showAlert({
                        title: 'Başarılı',
                        message: 'Fotoğrafınız moderasyon onayına gönderildi. Onaylandıktan sonra albümünüzde görünecektir.',
                        type: 'success'
                    });
                }
            } catch (e) {
                console.error('Album upload error:', e);
                showAlert({
                    title: 'Hata',
                    message: 'Fotoğraf yüklenirken bir sorun oluştu.',
                    type: 'error'
                });
            } finally {
                setLoading(false);
            }
        }
    };

    const handleUpdateProfile = async (field, value) => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await axios.put(`${API_URL}/users/${user.id}/profile`, { [field]: value }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.data) {
                const updatedUser = { ...user, ...res.data };
                setUser(updatedUser);
                await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
            }
        } catch (e) {
            console.error('Update profile error:', e);
            showAlert({ title: 'Hata', message: 'Bilgiler güncellenirken bir sorun oluştu.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const toggleInterest = (interest) => {
        let currentInterests = user?.interests || [];
        if (typeof currentInterests === 'string') {
            try { currentInterests = JSON.parse(currentInterests); }
            catch (e) { currentInterests = []; }
        }
        if (!Array.isArray(currentInterests)) currentInterests = [];

        let newInterests;
        if (currentInterests.includes(interest)) {
            newInterests = currentInterests.filter(i => i !== interest);
        } else {
            if (currentInterests.length >= 3) {
                showAlert({
                    title: 'Uyarı',
                    message: 'En fazla 3 ilgi alanı seçebilirsiniz.',
                    type: 'warning'
                });
                return;
            }
            newInterests = [...currentInterests, interest];
        }
        
        // Optimistic update
        setUser({ ...user, interests: newInterests });
        
        handleUpdateProfile('interests', JSON.stringify(newInterests));
    };

    const handleRemovePhoto = async (photoUrl, isPending = false, photoId = null) => {
        try {
            const token = await AsyncStorage.getItem('token');
            const targetUrl = `${API_URL}/users/${user.id}/remove-photo`;
            console.log('Attempting to remove photo:', { targetUrl, photoUrl, isPending, photoId });
            
            const res = await axios.post(targetUrl, {
                url: photoUrl,
                isPending,
                photoId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                if (isPending) {
                    setPendingPhotos(prev => prev.filter(p => p.id !== photoId));
                } else {
                    const newPhotos = userPhotos.filter(p => p !== photoUrl);
                    setUserPhotos(newPhotos);
                    setUser({ ...user, photos: newPhotos });
                }
            }
        } catch (e) {
            console.error('Remove photo error:', e);
            
            // Gracefully handle 404 (already deleted or not found)
            if (e.response?.status === 404) {
                if (isPending) {
                    setPendingPhotos(prev => prev.filter(p => p.id !== photoId));
                } else {
                    const newPhotos = userPhotos.filter(p => p !== photoUrl);
                    setUserPhotos(newPhotos);
                    setUser({ ...user, photos: newPhotos });
                }
                return;
            }

            const errorMsg = e.response?.data?.error || 'Fotoğraf silinirken bir sorun oluştu.';
            showAlert({ title: 'Hata', message: errorMsg, type: 'error' });
        }
    };

    const handleBoost = async () => {
        if (user?.is_boosted) {
            showAlert({ title: 'Zaten Öne Çıkmışsın!', message: 'Profilin şu an diğer kullanıcılara daha fazla gösteriliyor.', type: 'info' });
            return;
        }

        const cost = 500;
        if (balance < cost) {
            showAlert({ 
                title: 'Yetersiz Bakiye', 
                message: `Profilini öne çıkarmak için ${cost} Coin gerekli. Mağazaya gitmek ister misin?`, 
                type: 'warning',
                onConfirm: () => navigation.navigate('Shop')
            });
            return;
        }

        showAlert({
            title: 'Profilini Öne Çıkar',
            message: `${cost} Coin karşılığında profilini 1 HAFTA boyunca en başa taşıyalım mı?`,
            type: 'info',
            onConfirm: async () => {
                setLoading(true);
                try {
                    const token = await AsyncStorage.getItem('token');
                    const res = await axios.post(`${API_URL}/boosts/${user.id}`, { cost, durationMinutes: 10080 }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    
                    if (res.data) {
                        showAlert({ title: 'Başarılı!', message: 'Profilin 1 hafta boyunca öne çıkarıldı! Artık daha fazla etkileşim alacaksın.', type: 'success' });
                        // Refresh data
                        const updatedUser = { ...user, is_boosted: true, balance: res.data.newBalance };
                        setUser(updatedUser);
                        setBalance(res.data.newBalance);
                    }
                } catch (e) {
                    console.error('Boost error:', e);
                    showAlert({ title: 'Hata', message: 'İşlem gerçekleştirilemedi.', type: 'error' });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const stats = [
        { label: 'Takipçi', value: user?.followers_count || '0' },
        { label: 'Takip', value: user?.following_count || '0' },
        { label: 'Hediye', value: user?.gifts_count || '0' }
    ];

    const isMale = (user?.gender || '').toLowerCase() === 'erkek';
    const isShowWallet = !isMale && (['operator', 'moderator', 'admin', 'super_admin', 'staff'].includes(user?.role) || (user?.gender || '').toLowerCase() === 'kadin');
    const isFemaleOrOperator = !isMale && (isOperator || (user?.gender || '').toLowerCase() === 'kadin' || ['operator', 'moderator', 'admin', 'super_admin', 'staff'].includes(user?.role));
    const todayCoins = operatorStats ? parseFloat(operatorStats.earned_today || operatorStats.coins_earned || 0) : 0;

    return (
        <View style={[styles.mainContainer, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle="light-content" />
            
            {/* Background Image Layer */}
            <View style={styles.bgWrapper}>
                <Image 
                    source={require('../../assets/fiva_profile_banner.png')} 
                    style={styles.backgroundImage}
                />
                <LinearGradient
                    colors={
                        themeMode === 'dark'
                            ? ['rgba(9, 2, 26, 0.1)', 'rgba(9, 2, 26, 0.7)', theme.colors.background]
                            : ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.7)', theme.colors.background]
                    }
                    style={StyleSheet.absoluteFill}
                />
            </View>
 
            <Animated.ScrollView
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Agency Invitation Banner */}
                {pendingInvitations && pendingInvitations.length > 0 && (
                    <View style={styles.inviteBannerContainer}>
                        {pendingInvitations.map((invite) => (
                            <GlassCard key={invite.id} intensity={30} tint="dark" style={styles.inviteBannerCard}>
                                <LinearGradient
                                    colors={['rgba(139, 92, 246, 0.15)', 'rgba(236, 72, 153, 0.15)']}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                />
                                <View style={styles.inviteBannerHeader}>
                                    <View style={styles.inviteIconCircle}>
                                        <Ionicons name="business" size={20} color="#ec4899" />
                                    </View>
                                    <View style={styles.inviteHeaderTextContainer}>
                                        <Text style={styles.inviteBannerTitle}>Ajans Daveti ⚡</Text>
                                        <Text style={styles.inviteBannerText}>
                                            <Text style={styles.agencyNameHighlight}>{invite.agency_name}</Text> sizi ajansına katılmaya davet ediyor!
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.inviteActionsRow}>
                                    <TouchableOpacity 
                                        style={[styles.inviteActionBtn, styles.rejectBtn]} 
                                        onPress={() => handleRejectInvitation(invite.id)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.rejectBtnText}>Reddet</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={styles.inviteActionBtn}
                                        onPress={() => handleAcceptInvitation(invite.id)}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={['#10b981', '#059669']}
                                            style={styles.acceptBtnGradient}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                        >
                                            <Text style={styles.acceptBtnText}>Kabul Et</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </GlassCard>
                        ))}
                    </View>
                )}

                {/* Modern Header Section */}
                <View style={styles.modernHeader}>
                    <TouchableOpacity style={styles.avatarContainer} onPress={pickAvatar} activeOpacity={0.9}>
                        <LinearGradient
                            colors={['#ec4899', '#8b5cf6']}
                            style={styles.avatarGlow}
                        />
                        <Image 
                            source={{ uri: user?.avatar_url || user?.profile_image || 'https://via.placeholder.com/150' }} 
                            style={[styles.avatarImage, { borderColor: theme.colors.background, backgroundColor: theme.colors.background }]} 
                        />
                        <View style={[styles.cameraBadge, { borderColor: theme.colors.background }]}>
                            <Ionicons name="camera" size={16} color="#fff" />
                        </View>
                        <View style={[styles.onlineStatus, { borderColor: theme.colors.background }]} />
                    </TouchableOpacity>

                    <View style={styles.profileInfo}>
                        <Text style={styles.userName}>{user?.name || 'Kullanıcı'}, {user?.age || '24'}</Text>
                        <View style={styles.idBadge}>
                            <Text style={styles.idText}>ID: {String(user?.id || '').slice(-6).toUpperCase()}</Text>
                        </View>
                        {isEditingBio ? (
                            <View style={styles.inlineBioEdit}>
                                <TextInput
                                    style={styles.inlineBioInput}
                                    value={tempBio}
                                    onChangeText={setTempBio}
                                    autoFocus
                                    multiline
                                    onBlur={() => {
                                        setIsEditingBio(false);
                                        handleUpdateProfile('bio', tempBio);
                                    }}
                                    maxLength={200}
                                />
                                <TouchableOpacity onPress={() => {
                                    setIsEditingBio(false);
                                    handleUpdateProfile('bio', tempBio);
                                }}>
                                    <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity 
                                style={styles.bioEditContainer} 
                                onPress={() => { 
                                    setTempBio(user?.bio || ''); 
                                    setIsEditingBio(true);
                                }}
                            >
                                <Text style={styles.userBio} numberOfLines={2}>
                                    {user?.bio || 'Biyografi henüz eklenmemiş...'}
                                </Text>
                                <View style={styles.bioPencilCircle}>
                                    <Ionicons name="pencil" size={10} color="#fff" />
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Glass Stats Pods */}
                    <View style={styles.statsContainer}>
                        {stats.map((stat, index) => (
                            <View key={index} style={styles.statPod}>
                                <BlurView intensity={25} tint="light" style={styles.statBlur}>
                                    <Text style={styles.statValue}>{stat.value}</Text>
                                    <Text style={styles.statLabel}>{stat.label}</Text>
                                </BlurView>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Floating Action Grid */}
                <View style={styles.glassCardWrapper}>
                    <LinearGradient colors={themeMode === 'dark' ? theme.gradients.card : ['#fff', '#f0f0f0']} style={styles.glassCard}>
                        <View style={styles.quickActionsGrid}>
                            <TouchableOpacity style={[styles.qaItem, isShowWallet && { width: '13%' }]} onPress={() => {
                                if (user?.is_agency_owner) {
                                    navigation.navigate('AgencyDashboard');
                                } else {
                                    navigation.navigate('AgencyJoin');
                                }
                            }}>
                                <View style={styles.qaIconOnly}>
                                    <Ionicons name="business" size={26} color="#3b82f6" />
                                </View>
                                <Text style={styles.qaLabel}>
                                     {(user?.agency_id || user?.is_agency_owner) ? 'Ajansım' : 'Ajans'}
                                 </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.qaItem, isShowWallet && { width: '13%' }]} onPress={() => navigation.navigate('ProfileVisitors')}>
                                <View style={styles.qaIconOnly}>
                                    <View style={styles.avatarIconWrapper}>
                                        <Image 
                                            source={{ uri: 'https://i.pravatar.cc/100?u=visitor' }} 
                                            style={styles.qaAvatarIcon} 
                                        />
                                        <View style={styles.notifDot} />
                                    </View>
                                </View>
                                <Text style={styles.qaLabel}>Ziyaretçi</Text>
                            </TouchableOpacity>

                            {isShowWallet && (
                                <TouchableOpacity style={[styles.qaItem, { width: '13%' }]} onPress={() => navigation.navigate('Wallet')}>
                                    <View style={styles.qaIconOnly}>
                                        <Ionicons name="wallet" size={26} color="#22d3ee" />
                                    </View>
                                    <Text style={styles.qaLabel}>Cüzdanım</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity style={[styles.qaItem, isShowWallet && { width: '13%' }]} onPress={() => navigation.navigate('Vip')}>
                                <View style={styles.qaIconOnly}>
                                    <FontAwesome5 name="medal" size={24} color="#fbbf24" />
                                </View>
                                <Text style={styles.qaLabel}>VIP</Text>
                                <View style={styles.vipProgressBar} />
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.qaItem, isShowWallet && { width: '13%' }]} onPress={() => navigation.navigate('Shop')}>
                                <View style={styles.qaIconOnly}>
                                    <Ionicons name="cart" size={28} color="#f59e0b" />
                                </View>
                                <Text style={styles.qaLabel}>Mağaza</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.qaItem, isShowWallet && { width: '13%' }]} onPress={() => navigation.navigate('WhoFavoritedMe')}>
                                <View style={styles.qaIconOnly}>
                                    <Ionicons name="heart" size={26} color="#ec4899" />
                                </View>
                                <Text style={styles.qaLabel}>Hayran</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.qaItem, isShowWallet && { width: '13%' }]} onPress={() => navigation.navigate('Favorites')}>
                                <View style={styles.qaIconOnly}>
                                    <Ionicons name="star" size={26} color="#a855f7" />
                                </View>
                                <Text style={styles.qaLabel}>Favori</Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </View>

                {/* Wallet Glass Card */}
                {!isShowWallet && (
                    <TouchableOpacity style={styles.glassCardWrapper} onPress={() => navigation.navigate('Shop')} activeOpacity={0.8}>
                        <LinearGradient colors={themeMode === 'dark' ? theme.gradients.card : ['#fff', '#f0f0f0']} style={styles.walletCard}>
                            <View style={styles.walletLeft}>
                                <View style={styles.coinIconBox}>
                                    <FontAwesome5 name="coins" size={20} color="#f59e0b" />
                                </View>
                                <View>
                                    <Text style={styles.walletTitle}>CÜZDAN BAKİYESİ</Text>
                                    <Text style={styles.walletValue}>{balance} Kredi</Text>
                                </View>
                            </View>
                            <LinearGradient
                                colors={['#FDE68A', '#F59E0B']}
                                style={styles.depositBtn}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={styles.depositBtnText}>Yükle</Text>
                            </LinearGradient>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Boost Premium Card */}
                <TouchableOpacity 
                    style={styles.glassCardWrapper} 
                    activeOpacity={0.8}
                    onPress={handleBoost}
                >
                    <LinearGradient colors={themeMode === 'dark' ? theme.gradients.card : ['#fff', '#f0f0f0']} style={styles.boostCard}>
                        <View style={styles.boostLeft}>
                            <View style={[styles.boostIconCircle, user?.is_boosted && { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                                <Ionicons name={user?.is_boosted ? "flash" : "rocket"} size={18} color={user?.is_boosted ? "#10b981" : "#ec4899"} />
                            </View>
                            <View>
                                <Text style={styles.boostMainText}>
                                    {user?.is_boosted ? 'Profilin Öne Çıkarıldı' : 'Profilini Öne Çıkar'}
                                </Text>
                                <Text style={styles.boostSubText}>
                                    {user?.is_boosted ? 'Daha fazla eşleşme ve etkileşim alıyorsun' : 'Daha fazla eşleşme ve etkileşim al'}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#4b5563" />
                    </LinearGradient>
                </TouchableOpacity>

                {/* Invite & Earn Card */}
                <TouchableOpacity 
                    style={styles.glassCardWrapper} 
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('Invite')}
                >
                    <LinearGradient colors={['#FF5F6D', '#FFC371']} style={styles.boostCard} start={{x:0, y:0}} end={{x:1, y:1}}>
                        <View style={styles.boostLeft}>
                            <View style={[styles.boostIconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.25)' }]}>
                                <Ionicons name="gift" size={20} color="#fff" />
                            </View>
                            <View>
                                <Text style={[styles.boostMainText, { color: '#fff', textShadowColor: 'rgba(0,0,0,0.1)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 2 }]}>
                                    Davet Et, Kazan!
                                </Text>
                                <Text style={[styles.boostSubText, { color: 'rgba(255,255,255,0.9)' }]}>
                                    Arkadaşlarını davet et, 500 Coin kazan.
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>

                {/* Görevler (Missions) Card - Visible to female users and operators */}
                {isFemaleOrOperator && (
                    <TouchableOpacity
                        style={styles.glassCardWrapper}
                        activeOpacity={0.82}
                        onPress={() => navigation.navigate('MissionBoard')}
                    >
                        <LinearGradient
                            colors={['#ff2d55', '#ff6b9d', '#c026d3', '#7c3aed']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.missionCard}
                        >
                            {/* Left: label + count */}
                            <View style={styles.missionLeftPanel}>
                                <Text style={styles.missionLeftLabel}>GÜNLÜK</Text>
                                <Text style={styles.missionLeftCount}>
                                    {Math.round(todayCoins).toLocaleString()}
                                </Text>
                                <Text style={styles.missionLeftUnit}>💎 kazandın</Text>
                            </View>

                            {/* Divider */}
                            <View style={styles.missionDivider} />

                            {/* Right content */}
                            <View style={styles.missionRightPanel}>
                                <Text style={styles.missionCardTitle}>Günlük Görevler</Text>
                                <Text style={styles.missionCardSubtitle}>
                                    Sohbet et, elmas kazan!
                                </Text>
                                <View style={{ marginTop: 10 }}>
                                    <View style={styles.missionProgressTrack}>
                                        <View style={[styles.missionProgressFill, {
                                            width: `${Math.min(100, (todayCoins / 5000) * 100)}%`,
                                            backgroundColor: 'rgba(255,255,255,0.95)'
                                        }]} />
                                    </View>
                                    <Text style={styles.missionProgressLabel}>
                                        {Math.round(todayCoins).toLocaleString()} / 5.000 💎
                                    </Text>
                                </View>
                            </View>

                            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" style={{ alignSelf: 'center', marginRight: 4 }} />
                        </LinearGradient>
                    </TouchableOpacity>
                )}




                {/* Album Section */}
                <View style={styles.glassCardWrapper}>
                    <LinearGradient colors={themeMode === 'dark' ? theme.gradients.card : ['#fff', '#f0f0f0']} style={styles.albumSection}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Albüm</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.albumScroll}>
                            <TouchableOpacity style={styles.addPhotoButton} onPress={pickAlbumPhoto} activeOpacity={0.7}>
                                <Ionicons name="add" size={32} color="#8e85a6" />
                            </TouchableOpacity>
                            {userPhotos.map((photo, index) => (
                                <View key={`approved_${index}`} style={styles.albumPhotoWrapper}>
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setCurrentImageIndex(index);
                                            setIsImageViewerVisible(true);
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <Image source={{ uri: resolveImageUrl(photo) }} style={styles.albumPhoto} />
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={styles.removePhotoBadge} 
                                        onPress={() => handleRemovePhoto(photo)}
                                    >
                                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {pendingPhotos.map((photo, index) => (
                                <View key={`pending_${index}`} style={styles.albumPhotoWrapper}>
                                    <View style={styles.pendingImageContainer}>
                                        <Image source={{ uri: resolveImageUrl(photo.url) }} style={[styles.albumPhoto, { opacity: 0.6 }]} />
                                        <View style={styles.moderationOverlay}>
                                            <Ionicons name="time" size={16} color="white" />
                                            <Text style={styles.moderationText}>İncelemede</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity 
                                        style={styles.removePhotoBadge} 
                                        onPress={() => handleRemovePhoto(photo.url, true, photo.id)}
                                    >
                                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    </LinearGradient>
                </View>

                {/* Merged Info Sections */}
                <View style={styles.glassCardWrapper}>
                    <LinearGradient colors={themeMode === 'dark' ? theme.gradients.card : ['#fff', '#f0f0f0']} style={styles.infoSection}>
                        {/* Temel Bilgiler Section */}
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Temel Bilgiler</Text>
                            <TouchableOpacity onPress={() => { setEditingSection('basic'); setIsEditModalVisible(true); }} style={styles.miniEditBtn}>
                                <Text style={styles.editLink}>Düzenle</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.infoGrid}>
                            <View style={styles.infoPill}>
                                <Ionicons name="calendar" size={16} color="#f97316" />
                                <Text style={styles.infoPillText}>{user?.age || '18'}</Text>
                            </View>
                            <View style={styles.infoPill}>
                                <Ionicons name="briefcase" size={16} color="#3b82f6" />
                                <Text style={styles.infoPillText}>{user?.job || 'Yazılımcı'}</Text>
                            </View>
                            <View style={styles.infoPill}>
                                <Ionicons name="school" size={16} color="#10b981" />
                                <Text style={styles.infoPillText}>{user?.edu || 'Üniversite'}</Text>
                            </View>
                            <View style={styles.infoPill}>
                                <Ionicons name="man" size={16} color="#8b5cf6" />
                                <Text style={styles.infoPillText}>{user?.boy || '175'}</Text>
                            </View>
                            <View style={styles.infoPill}>
                                <Ionicons name="barbell" size={16} color="#ef4444" />
                                <Text style={styles.infoPillText}>{user?.kilo || '70'}</Text>
                            </View>
                            <View style={styles.infoPill}>
                                <Ionicons name="star" size={16} color="#a855f7" />
                                <Text style={styles.infoPillText}>{user?.zodiac || 'Aslan'}</Text>
                            </View>
                            <View style={styles.infoPill}>
                                <Ionicons name="heart" size={16} color="#ec4899" />
                                <Text style={styles.infoPillText}>{user?.relationship || 'Sohbet'}</Text>
                            </View>
                        </View>

                        <View style={styles.sectionDivider} />

                        {/* İlgi Alanları Section */}
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>İlgi Alanları</Text>
                            <TouchableOpacity onPress={() => { setEditingSection('interests'); setIsEditModalVisible(true); }} style={styles.miniEditBtn}>
                                <Text style={styles.editLink}>Düzenle</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.infoGrid}>
                            {(() => {
                                let ints = user?.interests;
                                if (typeof ints === 'string') {
                                    try { ints = JSON.parse(ints); }
                                    catch (e) { ints = ints.split(',').map(i => i.trim()); }
                                }
                                if (!Array.isArray(ints) || ints.length === 0) {
                                    return <Text style={styles.emptyInfoText}>Henüz ilgi alanı eklenmemiş.</Text>;
                                }
                                return ints.map((interest, idx) => (
                                    <View key={idx} style={styles.infoPill}>
                                        <Text style={styles.infoPillText}>{interest}</Text>
                                    </View>
                                ));
                            })()}
                        </View>
                    </LinearGradient>
                </View>

                {/* Footer Actions */}
                <LinearGradient colors={themeMode === 'dark' ? theme.gradients.card : ['#fff', '#f0f0f0']} style={styles.footerContainer}>
                    <TouchableOpacity style={styles.footerItem} onPress={() => navigation.navigate('Settings')}>
                        <View style={[styles.footerIconBg, { backgroundColor: '#3b82f620' }]}>
                            <Ionicons name="settings-outline" size={20} color="#3b82f6" />
                        </View>
                        <Text style={styles.footerText}>Ayarlar</Text>
                        <Ionicons name="chevron-forward" size={16} color="#4b3f61" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.footerItem} 
                        onPress={() => {
                            Linking.openURL('mailto:falkasoft@gmail.com').catch(() => {
                                Alert.alert('Hata', 'E-posta uygulaması bulunamadı.');
                            });
                        }}
                    >
                        <View style={[styles.footerIconBg, { backgroundColor: '#f59e0b20' }]}>
                            <Ionicons name="mail-outline" size={20} color="#f59e0b" />
                        </View>
                        <Text style={styles.footerText}>E-posta Destek</Text>
                        <Ionicons name="chevron-forward" size={16} color="#4b3f61" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.footerItem} 
                        onPress={() => {
                            Linking.openURL('https://wa.me/905414738700').catch(() => {
                                Alert.alert('Hata', 'WhatsApp uygulaması bulunamadı.');
                            });
                        }}
                    >
                        <View style={[styles.footerIconBg, { backgroundColor: '#25d36620' }]}>
                            <Ionicons name="logo-whatsapp" size={20} color="#25d366" />
                        </View>
                        <Text style={styles.footerText}>WhatsApp Destek</Text>
                        <Ionicons name="chevron-forward" size={16} color="#4b3f61" />
                    </TouchableOpacity>
                </LinearGradient>

                <View style={{ height: 120 }} />
            </Animated.ScrollView>

            {/* Photo Viewer */}
            <ImageViewing
                images={userPhotos.map(p => ({ uri: resolveImageUrl(p) }))}
                imageIndex={currentImageIndex}
                visible={isImageViewerVisible}
                onRequestClose={() => setIsImageViewerVisible(false)}
                swipeToCloseEnabled={true}
                doubleTapToZoomEnabled={true}
            />

            {/* Edit Modal */}
            <Modal
                visible={isEditModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity 
                        style={StyleSheet.absoluteFill} 
                        onPress={() => setIsEditModalVisible(false)} 
                    />
                    <BlurView intensity={95} tint="dark" style={styles.modalContent}>
                        <LinearGradient
                            colors={['#0f0720', '#1a0b2e', '#2d0a31']}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>
                                    {editingSection === 'basic' ? 'Profilini Tamamla' : 'İlgi Alanlarını Keşfet'}
                                </Text>
                                <Text style={styles.modalSubtitle}>
                                    {editingSection === 'basic' ? 'Kendinden bahset, daha çok eşleş yakala' : 'Hobilerini seç, ortak noktaları bul'}
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setIsEditModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                            {editingSection === 'basic' ? (
                                <View style={styles.editContentWrapper}>
                                    {/* Meslek Card */}
                                    <View style={styles.modernEditCard}>
                                        <View style={styles.cardHeaderSmall}>
                                            <View style={[styles.cardIconBg, { backgroundColor: '#ec489920' }]}>
                                                <Ionicons name="briefcase" size={14} color="#ec4899" />
                                            </View>
                                            <Text style={styles.cardTitleSmall}>MESLEK</Text>
                                        </View>
                                        <View style={styles.optionGrid}>
                                            {editOptions.job.map(job => (
                                                <TouchableOpacity 
                                                    key={job} 
                                                    style={[styles.optionChip, user?.job === job && styles.optionChipSelected]}
                                                    onPress={() => handleUpdateProfile('job', job)}
                                                >
                                                    {user?.job === job && (
                                                        <LinearGradient
                                                            colors={['#7c3aed', '#ec4899']}
                                                            start={{ x: 0, y: 0 }}
                                                            end={{ x: 1, y: 1 }}
                                                            style={StyleSheet.absoluteFill}
                                                        />
                                                    )}
                                                    <Text style={[styles.optionText, user?.job === job && styles.optionTextSelected]}>{job}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Eğitim Card */}
                                    <View style={styles.modernEditCard}>
                                        <View style={styles.cardHeaderSmall}>
                                            <View style={[styles.cardIconBg, { backgroundColor: '#8b5cf620' }]}>
                                                <Ionicons name="school" size={14} color="#8b5cf6" />
                                            </View>
                                            <Text style={styles.cardTitleSmall}>EĞİTİM</Text>
                                        </View>
                                        <View style={styles.optionGrid}>
                                            {editOptions.edu.map(edu => (
                                                <TouchableOpacity 
                                                    key={edu} 
                                                    style={[styles.optionChip, user?.edu === edu && styles.optionChipSelected]}
                                                    onPress={() => handleUpdateProfile('edu', edu)}
                                                >
                                                    {user?.edu === edu && (
                                                        <LinearGradient
                                                            colors={['#7c3aed', '#ec4899']}
                                                            start={{ x: 0, y: 0 }}
                                                            end={{ x: 1, y: 1 }}
                                                            style={StyleSheet.absoluteFill}
                                                        />
                                                    )}
                                                    <Text style={[styles.optionText, user?.edu === edu && styles.optionTextSelected]}>{edu}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Burç Card */}
                                    <View style={styles.modernEditCard}>
                                        <View style={styles.cardHeaderSmall}>
                                            <View style={[styles.cardIconBg, { backgroundColor: '#f59e0b20' }]}>
                                                <Ionicons name="moon" size={14} color="#f59e0b" />
                                            </View>
                                            <Text style={styles.cardTitleSmall}>BURÇ</Text>
                                        </View>
                                        <View style={styles.optionGrid}>
                                            {editOptions.zodiac.map(z => (
                                                <TouchableOpacity 
                                                    key={z} 
                                                    style={[styles.optionChip, user?.zodiac === z && styles.optionChipSelected]}
                                                    onPress={() => handleUpdateProfile('zodiac', z)}
                                                >
                                                    {user?.zodiac === z && (
                                                        <LinearGradient
                                                            colors={['#7c3aed', '#ec4899']}
                                                            start={{ x: 0, y: 0 }}
                                                            end={{ x: 1, y: 1 }}
                                                            style={StyleSheet.absoluteFill}
                                                        />
                                                    )}
                                                    <Text style={[styles.optionText, user?.zodiac === z && styles.optionTextSelected]}>{z}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    {/* İlişki Card */}
                                    <View style={styles.modernEditCard}>
                                        <View style={styles.cardHeaderSmall}>
                                            <View style={[styles.cardIconBg, { backgroundColor: '#ef444420' }]}>
                                                <Ionicons name="heart" size={14} color="#ef4444" />
                                            </View>
                                            <Text style={styles.cardTitleSmall}>İLİŞKİ DURUMU / AMAÇ</Text>
                                        </View>
                                        <View style={styles.optionGrid}>
                                            {editOptions.relationship.map(r => (
                                                <TouchableOpacity 
                                                    key={r} 
                                                    style={[styles.optionChip, user?.relationship === r && styles.optionChipSelected]}
                                                    onPress={() => handleUpdateProfile('relationship', r)}
                                                >
                                                    {user?.relationship === r && (
                                                        <LinearGradient
                                                            colors={['#7c3aed', '#ec4899']}
                                                            start={{ x: 0, y: 0 }}
                                                            end={{ x: 1, y: 1 }}
                                                            style={StyleSheet.absoluteFill}
                                                        />
                                                    )}
                                                    <Text style={[styles.optionText, user?.relationship === r && styles.optionTextSelected]}>{r}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Boy Scroll */}
                                    <View style={styles.modernEditCard}>
                                        <View style={styles.cardHeaderSmall}>
                                            <View style={[styles.cardIconBg, { backgroundColor: '#3b82f620' }]}>
                                                <Ionicons name="resize" size={14} color="#3b82f6" />
                                            </View>
                                            <Text style={styles.cardTitleSmall}>BOY (CM)</Text>
                                        </View>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollOptions}>
                                            {editOptions.boy.map(h => (
                                                <TouchableOpacity 
                                                    key={h} 
                                                    style={[styles.optionChip, user?.boy === String(h) && styles.optionChipSelected]}
                                                    onPress={() => handleUpdateProfile('boy', String(h))}
                                                >
                                                    {user?.boy === String(h) && (
                                                        <LinearGradient
                                                            colors={['#7c3aed', '#ec4899']}
                                                            start={{ x: 0, y: 0 }}
                                                            end={{ x: 1, y: 1 }}
                                                            style={StyleSheet.absoluteFill}
                                                        />
                                                    )}
                                                    <Text style={[styles.optionText, user?.boy === String(h) && styles.optionTextSelected]}>{h}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>

                                    {/* Kilo Scroll */}
                                    <View style={styles.modernEditCard}>
                                        <View style={styles.cardHeaderSmall}>
                                            <View style={[styles.cardIconBg, { backgroundColor: '#10b98120' }]}>
                                                <Ionicons name="speedometer" size={14} color="#10b981" />
                                            </View>
                                            <Text style={styles.cardTitleSmall}>KİLO (KG)</Text>
                                        </View>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollOptions}>
                                            {editOptions.kilo.map(k => (
                                                <TouchableOpacity 
                                                    key={k} 
                                                    style={[styles.optionChip, user?.kilo === String(k) && styles.optionChipSelected]}
                                                    onPress={() => handleUpdateProfile('kilo', String(k))}
                                                >
                                                    {user?.kilo === String(k) && (
                                                        <LinearGradient
                                                            colors={['#7c3aed', '#ec4899']}
                                                            start={{ x: 0, y: 0 }}
                                                            end={{ x: 1, y: 1 }}
                                                            style={StyleSheet.absoluteFill}
                                                        />
                                                    )}
                                                    <Text style={[styles.optionText, user?.kilo === String(k) && styles.optionTextSelected]}>{k}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.editContentWrapper}>
                                    <View style={styles.modernEditCard}>
                                        <View style={styles.cardHeaderSmall}>
                                            <View style={[styles.cardIconBg, { backgroundColor: '#ec489920' }]}>
                                                <Ionicons name="sparkles" size={14} color="#ec4899" />
                                            </View>
                                            <Text style={styles.cardTitleSmall}>İLGİ ALANLARI</Text>
                                        </View>
                                        <View style={styles.optionGrid}>
                                            {editOptions.interests.map(interest => {
                                                let currentInts = user?.interests || [];
                                                if (typeof currentInts === 'string') {
                                                    try { currentInts = JSON.parse(currentInts); } catch (e) { currentInts = []; }
                                                }
                                                if (!Array.isArray(currentInts)) currentInts = [];
                                                const isSelected = currentInts.includes(interest);
                                                return (
                                                    <TouchableOpacity 
                                                        key={interest} 
                                                        style={[styles.optionChip, isSelected && styles.optionChipSelected]}
                                                        onPress={() => {
                                                            toggleInterest(interest);
                                                        }}
                                                    >
                                                        {isSelected && (
                                                            <LinearGradient
                                                                colors={['#7c3aed', '#ec4899']}
                                                                start={{ x: 0, y: 0 }}
                                                                end={{ x: 1, y: 1 }}
                                                                style={StyleSheet.absoluteFill}
                                                            />
                                                        )}
                                                        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{interest}</Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>
                                </View>
                            )}
                            <View style={{ height: 100 }} />
                        </ScrollView>
                    </BlurView>
                </View>
            </Modal>

            {/* Loading Overlay */}
            {loading && (
                <View style={styles.loadingOverlay}>
                    <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill}>
                        <View style={styles.loadingOverlay}>
                            <View style={styles.loadingContent}>
                                <ActivityIndicator size="large" color="#ec4899" />
                                <Text style={styles.loadingText}>İşleniyor...</Text>
                            </View>
                        </View>
                    </BlurView>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContent: {
        padding: 30,
        borderRadius: 24,
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    loadingText: {
        color: '#fff',
        marginTop: 15,
        fontWeight: 'bold',
        fontSize: 16,
    },
    mainContainer: {
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
    scrollContent: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    modernHeader: {
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 20,
    },
    avatarGlow: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: 60,
        opacity: 0.6,
    },
    avatarImage: {
        width: 110,
        height: 110,
        borderRadius: 55,
        borderWidth: 3,
        borderColor: '#09021a',
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: '#ec4899',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#09021a',
        elevation: 5,
    },
    onlineStatus: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#10b981',
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 3,
        borderColor: '#09021a',
    },
    profileInfo: {
        alignItems: 'center',
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    idBadge: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 8,
    },
    idText: {
        color: '#8e85a6',
        fontSize: 12,
        fontWeight: '600',
    },
    userBio: {
        color: '#fff',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 10,
        lineHeight: 18,
        fontSize: 12,
        fontWeight: 'bold',
    },
    inlineBioEdit: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        marginHorizontal: 30,
        paddingHorizontal: 12,
        marginTop: 8,
    },
    inlineBioInput: {
        flex: 1,
        color: '#fff',
        fontSize: 12,
        paddingVertical: 8,
        fontWeight: 'bold',
    },
    bioEditContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
        marginTop: 4,
    },
    bioPencilCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    bioInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        color: '#fff',
        fontSize: 16,
        textAlignVertical: 'top',
        minHeight: 100,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    saveBioBtn: {
        backgroundColor: '#8b5cf6',
        paddingVertical: 14,
        borderRadius: 16,
        marginTop: 20,
        alignItems: 'center',
    },
    saveBioText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 25,
        gap: 12,
    },
    statPod: {
        width: (width - 64) / 3,
        height: 60,
        borderRadius: 16,
        overflow: 'hidden',
    },
    statBlur: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    statValue: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#fff',
    },
    statLabel: {
        fontSize: 9,
        color: '#8e85a6',
        marginTop: 1,
    },
    glassCardWrapper: {
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    glassCard: {
        padding: 20,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    quickActionsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    qaItem: {
        alignItems: 'center',
        width: '16%',
    },
    qaIconOnly: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    qaLabel: {
        fontSize: 8,
        color: '#8e85a6',
        fontWeight: '600',
    },
    avatarIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    qaAvatarIcon: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    notifDot: {
        position: 'absolute',
        bottom: -2,
        left: 16,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#ef4444',
        borderWidth: 2,
        borderColor: '#fff',
    },
    vipProgressBar: {
        width: 24,
        height: 3,
        backgroundColor: '#ec4899',
        borderRadius: 2,
        marginTop: 4,
        opacity: 0.8,
    },
    walletCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 24,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    walletLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    coinIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    walletTitle: {
        fontSize: 8,
        color: '#8e85a6',
        letterSpacing: 1.5,
        fontWeight: 'bold',
    },
    walletValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 1,
    },
    depositBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    depositBtnText: {
        color: '#78350F',
        fontWeight: '900',
        fontSize: 13,
    },
    boostCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 24,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    boostLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    boostIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(236, 72, 153, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    boostMainText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
    },
    boostSubText: {
        color: '#8e85a6',
        fontSize: 10,
        marginTop: 1,
    },
    infoSection: {
        padding: 24,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    sectionDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginVertical: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#fff',
    },
    editLink: {
        color: '#8b5cf6',
        fontWeight: 'bold',
        fontSize: 11,
    },
    miniEditBtn: {
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    emptyInfoText: {
        color: '#8e85a6',
        fontSize: 14,
        marginTop: 5,
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        height: '85%',
        overflow: 'hidden',
    },
    modalHeader: {
        padding: 24,
        paddingBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: -0.5,
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#8e85a6',
        marginTop: 4,
        fontWeight: '500',
    },
    closeModalBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalScroll: {
        flex: 1,
    },
    editContentWrapper: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    modernEditCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 28,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    cardHeaderSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 10,
    },
    cardIconBg: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitleSmall: {
        fontSize: 11,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 1.5,
        opacity: 0.9,
    },
    optionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionChip: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    optionChipSelected: {
        borderColor: 'transparent',
        shadowColor: '#ec4899',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    optionText: {
        color: '#8e85a6',
        fontSize: 13,
        fontWeight: '700',
    },
    optionTextSelected: {
        color: '#fff',
    },
    horizontalScrollOptions: {
        marginHorizontal: -4,
    },
    infoPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
    },
    infoPillText: {
        color: '#fff',
        fontSize: 11,
        marginLeft: 6,
    },
    albumSection: {
        padding: 20,
    },
    albumScroll: {
        marginTop: 10,
    },
    addPhotoButton: {
        width: 80,
        height: 80,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'rgba(142, 133, 166, 0.3)',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginRight: 12,
    },
    albumPhotoWrapper: {
        width: 80,
        height: 80,
        borderRadius: 16,
        marginRight: 12,
        position: 'relative',
    },
    albumPhoto: {
        width: '100%',
        height: '100%',
        borderRadius: 16,
        resizeMode: 'cover',
    },
    removePhotoBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#fff',
        borderRadius: 10,
        zIndex: 10,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    pendingImageContainer: {
        width: '100%',
        height: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
    },
    moderationOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
        gap: 2,
    },
    moderationText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: 'bold',
    },
    footerContainer: {
        marginHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 32,
        padding: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    footerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
    },
    footerIconBg: {
        width: 34,
        height: 34,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    footerText: {
        color: '#fff',
        fontSize: 13,
        flex: 1,
        fontWeight: '500',
    },
    inviteBannerContainer: {
        marginHorizontal: 16,
        marginTop: 15,
        marginBottom: 5,
        zIndex: 50,
    },
    inviteBannerCard: {
        borderRadius: 24,
        padding: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        position: 'relative',
    },
    inviteBannerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    inviteIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(236, 72, 153, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    inviteHeaderTextContainer: {
        flex: 1,
    },
    inviteBannerTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    inviteBannerText: {
        color: 'rgba(255, 255, 255, 0.75)',
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
        lineHeight: 16,
    },
    agencyNameHighlight: {
        color: '#ec4899',
        fontWeight: '800',
    },
    inviteActionsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    inviteActionBtn: {
        flex: 1,
        height: 38,
        borderRadius: 14,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rejectBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    rejectBtnText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        fontWeight: '800',
    },
    acceptBtnGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '900',
    },
    miniProgressTrack: {
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 3,
        overflow: 'hidden'
    },
    miniProgressBar: {
        height: '100%',
        borderRadius: 3
    },
    missionCard: {
        flexDirection: 'row',
        borderRadius: 20,
        overflow: 'hidden',
    },
    missionLeftPanel: {
        width: 90,
        paddingVertical: 18,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    missionLeftLabel: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginBottom: 6,
    },
    missionLeftCount: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: -1,
    },
    missionLeftUnit: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 9,
        fontWeight: '600',
        marginTop: 3,
    },
    missionDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.25)',
        marginVertical: 12,
    },
    missionRightPanel: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 14,
        justifyContent: 'center',
    },
    missionCardTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: -0.3,
    },
    missionCardSubtitle: {
        color: 'rgba(255, 255, 255, 0.75)',
        fontSize: 11,
        fontWeight: '500',
        marginTop: 3,
    },
    missionProgressTrack: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    missionProgressFill: {
        height: '100%',
        borderRadius: 2,
    },
    missionProgressLabel: {
        color: 'rgba(255, 255, 255, 0.75)',
        fontSize: 10,
        fontWeight: '700',
        marginTop: 5,
    },
});

export default ProfileScreen;
